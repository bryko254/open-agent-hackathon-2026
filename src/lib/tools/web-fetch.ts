export interface FetchResult {
  ok: boolean;
  url: string;
  citationUrl?: string;
  title: string;
  text: string;
  status?: number;
  error?: string;
}

export const USER_AGENT =
  "EvidenceAgent/0.1 (Open Agent Hackathon 2026; +https://github.com/bryko254/open-agent-hackathon-2026)";

const MAX_CHARS = 12_000;
const TIMEOUT_MS = 12_000;

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? stripTags(match[1]).slice(0, 200) : "";
}

function readableHtml(html: string): { title: string; text: string } {
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  const main = withoutNoise.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  const article = withoutNoise.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  const body = withoutNoise.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  const chunk = main?.[1] || article?.[1] || body?.[1] || withoutNoise;
  return { title: extractTitle(withoutNoise), text: stripTags(chunk) };
}

function markdownBody(raw: string): { title: string; text: string } {
  let title = "";
  let body = raw;
  if (raw.startsWith("---")) {
    const end = raw.indexOf("\n---", 3);
    if (end >= 0) {
      const frontmatter = raw.slice(3, end);
      const titleMatch = frontmatter.match(/^title:\s*(.+)$/m);
      if (titleMatch) title = titleMatch[1].trim().replace(/^["']|["']$/g, "");
      body = raw.slice(end + 4);
    }
  }
  return { title, text: body.trim() };
}

function wikiSummary(data: unknown): { title: string; text: string; citationUrl?: string } | null {
  if (!data || typeof data !== "object") return null;
  const record = data as {
    title?: unknown;
    extract?: unknown;
    description?: unknown;
    content_urls?: { desktop?: { page?: unknown } };
  };
  if (typeof record.title !== "string" || typeof record.extract !== "string" || !record.extract.trim()) {
    return null;
  }
  const description = typeof record.description === "string" ? record.description.trim() : "";
  const text = description ? `${description}. ${record.extract.trim()}` : record.extract.trim();
  const page = record.content_urls?.desktop?.page;
  return {
    title: record.title,
    text,
    citationUrl: typeof page === "string" ? page : undefined,
  };
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "metadata.google.internal"
  ) {
    return true;
  }
  if (host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) return true;

  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return false;
  const parts = match.slice(1).map(Number);
  if (parts.some((part) => part > 255)) return true;
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

/** Fetch a public URL and return readable text for evidence. */
export async function webFetch(url: string): Promise<FetchResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, url, title: "", text: "", error: "Invalid URL" };
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { ok: false, url, title: "", text: "", error: "Only http(s) URLs are allowed" };
  }

  if (isBlockedHost(parsed.hostname)) {
    return { ok: false, url, title: "", text: "", error: "Blocked host" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(parsed.toString(), {
      cache: "no-store",
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/markdown, text/html;q=0.9, application/xhtml+xml;q=0.8, application/json;q=0.8, text/plain;q=0.7, */*;q=0.5",
      },
    });

    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    const raw = await res.text();
    let title = parsed.hostname;
    let text = raw;
    let citationUrl: string | undefined;

    const trimmed = raw.trim();
    const asJson =
      contentType.includes("json") || trimmed.startsWith("{") || trimmed.startsWith("[");
    const asHtml = contentType.includes("html") || /<!doctype html|<html[\s>]/i.test(trimmed.slice(0, 400));
    const asMarkdown = contentType.includes("markdown") || contentType.startsWith("text/plain");

    if (asJson && !asHtml) {
      try {
        const parsedJson = JSON.parse(raw) as unknown;
        const wiki = wikiSummary(parsedJson);
        if (wiki) {
          title = wiki.title;
          text = wiki.text;
          citationUrl = wiki.citationUrl;
        } else {
          title = `JSON from ${parsed.hostname}`;
          text = JSON.stringify(parsedJson, null, 2);
        }
      } catch {
        text = raw;
      }
    } else if (asMarkdown && !asHtml) {
      const md = markdownBody(raw);
      title = md.title || title;
      text = md.text;
    } else if (asHtml || contentType.includes("html")) {
      const readable = readableHtml(raw);
      title = readable.title || title;
      text = readable.text;
    }

    text = text.slice(0, MAX_CHARS);
    const tooThin = text.trim().length < 80;

    return {
      ok: res.ok && !tooThin,
      url: parsed.toString(),
      citationUrl,
      title,
      text,
      status: res.status,
      error: !res.ok ? `HTTP ${res.status}` : tooThin ? "Readable text too short to cite" : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fetch failed";
    return { ok: false, url: parsed.toString(), title: "", text: "", error: message };
  } finally {
    clearTimeout(timer);
  }
}
