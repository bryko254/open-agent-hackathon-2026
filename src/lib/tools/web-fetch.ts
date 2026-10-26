export interface FetchResult {
  ok: boolean;
  url: string;
  title: string;
  text: string;
  status?: number;
  error?: string;
}

const MAX_CHARS = 12_000;
const TIMEOUT_MS = 10_000;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? stripHtml(match[1]).slice(0, 200) : "";
}

function looksLikeProse(value: string): boolean {
  if (value.length < 120 || value.length > 20_000) return false;
  if (/^\s*(var |function |!function|\(function)/.test(value)) return false;
  const letters = value.match(/[A-Za-z]/g)?.length ?? 0;
  return letters / value.length > 0.5;
}

/** Docs sites often ship the markdown body inside __NEXT_DATA__. */
function extractNextData(html: string): { title: string; text: string } | null {
  const match = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i
  );
  if (!match) return null;

  let data: unknown;
  try {
    data = JSON.parse(match[1]);
  } catch {
    return null;
  }

  let best: { title: string; text: string } | null = null;
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    const record = node as Record<string, unknown>;
    const content =
      typeof record.content === "string"
        ? record.content
        : typeof record.markdown === "string"
          ? record.markdown
          : typeof record.mdx === "string"
            ? record.mdx
            : null;
    if (content && looksLikeProse(content)) {
      const title =
        typeof record.title === "string" && record.title.trim()
          ? record.title.trim()
          : "";
      if (!best || content.length > best.text.length) {
        best = { title, text: content };
      }
    }
    for (const value of Object.values(record)) visit(value);
  };
  visit(data);
  return best;
}

function extractHtml(html: string, fallbackTitle: string): { title: string; text: string } {
  const titleTag = extractTitle(html);
  const next = extractNextData(html);
  if (next) {
    return {
      title: next.title || titleTag || fallbackTitle,
      text: next.text,
    };
  }

  const meta =
    html.match(
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
    )?.[1] ||
    html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i
    )?.[1] ||
    "";
  const region =
    html.match(/<main[\s\S]*?<\/main>/i)?.[0] ||
    html.match(/<article[\s\S]*?<\/article>/i)?.[0] ||
    html;
  const paragraphs = [...region.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripHtml(match[1]))
    .filter((paragraph) => paragraph.length > 80)
    .slice(0, 8);
  const text = [stripHtml(meta), ...paragraphs].filter(Boolean).join("\n\n");
  return {
    title: titleTag || fallbackTitle,
    text: text || stripHtml(html),
  };
}

function titleFromMarkdown(text: string, fallback: string): string {
  const frontMatter = text.match(/^title:\s*(.+)$/m);
  if (frontMatter) return frontMatter[1].trim().replace(/^["']|["']$/g, "").slice(0, 200);
  const heading = text.match(/^#\s+(.+)$/m);
  return heading ? heading[1].trim().slice(0, 200) : fallback;
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "metadata.google.internal" ||
    host === "metadata.google.com" ||
    host === "::1" ||
    host === "0.0.0.0"
  ) {
    return true;
  }

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;
  const parts = ipv4.slice(1).map(Number);
  if (parts.some((part) => part > 255)) return true;
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

/** Fetch a public URL and return readable text for evidence. */
export async function webFetch(url: string): Promise<FetchResult> {
  let current: URL;
  try {
    current = new URL(url);
  } catch {
    return { ok: false, url, title: "", text: "", error: "Invalid URL" };
  }

  if (!["http:", "https:"].includes(current.protocol)) {
    return {
      ok: false,
      url,
      title: "",
      text: "",
      error: "Only http(s) URLs are allowed",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    let res: Response | null = null;
    for (let hop = 0; hop < 3; hop += 1) {
      if (isBlockedHost(current.hostname)) {
        return {
          ok: false,
          url: current.toString(),
          title: "",
          text: "",
          error: "Blocked host. Private, loopback, and metadata addresses are refused.",
        };
      }

      res = await fetch(current.toString(), {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "User-Agent": "EvidenceAgent/0.1 (+Open-Agent-Hackathon-2026)",
          Accept:
            "text/markdown,text/html,application/xhtml+xml,application/json,text/plain;q=0.9,*/*;q=0.8",
        },
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) {
          return {
            ok: false,
            url: current.toString(),
            title: "",
            text: "",
            status: res.status,
            error: `HTTP ${res.status} without a redirect location`,
          };
        }
        current = new URL(location, current);
        continue;
      }
      break;
    }

    if (!res) {
      return { ok: false, url: current.toString(), title: "", text: "", error: "No response" };
    }

    const length = Number(res.headers.get("content-length") || 0);
    if (length > 1_500_000) {
      return {
        ok: false,
        url: current.toString(),
        title: "",
        text: "",
        status: res.status,
        error: "Response is too large to cite",
      };
    }

    const contentType = res.headers.get("content-type") || "";
    const raw = await res.text();
    let title = current.hostname.replace(/^www\./, "");
    let text = raw;

    if (contentType.includes("html")) {
      const extracted = extractHtml(raw, title);
      title = extracted.title || title;
      text = extracted.text;
    } else if (contentType.includes("json")) {
      title = `JSON from ${title}`;
      try {
        text = JSON.stringify(JSON.parse(raw), null, 2);
      } catch {
        text = raw;
      }
    } else if (
      contentType.includes("markdown") ||
      contentType.includes("text/plain")
    ) {
      title = titleFromMarkdown(raw, title);
      text = raw;
    }

    text = text.slice(0, MAX_CHARS);
    if (res.ok && text.trim().length < 80) {
      return {
        ok: false,
        url: current.toString(),
        title,
        text,
        status: res.status,
        error: "Page returned too little readable text to cite",
      };
    }

    return {
      ok: res.ok,
      url: current.toString(),
      title,
      text,
      status: res.status,
      error: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fetch failed";
    return { ok: false, url: current.toString(), title: "", text: "", error: message };
  } finally {
    clearTimeout(timer);
  }
}
