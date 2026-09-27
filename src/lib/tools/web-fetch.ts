export interface FetchResult {
  ok: boolean;
  url: string;
  title: string;
  text: string;
  status?: number;
  error?: string;
}

const MAX_CHARS = 12_000;
const TIMEOUT_MS = 12_000;

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
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? stripHtml(m[1]).slice(0, 200) : "Untitled page";
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
    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "EvidenceAgent/0.1 (+Open-Agent-Hackathon-2026)",
        Accept: "text/html,application/xhtml+xml,application/json,text/plain;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });

    const contentType = res.headers.get("content-type") || "";
    const raw = await res.text();
    let title = parsed.hostname;
    let text = raw;

    if (contentType.includes("html")) {
      title = extractTitle(raw) || title;
      text = stripHtml(raw);
    } else if (contentType.includes("json")) {
      title = `JSON from ${parsed.hostname}`;
      try {
        text = JSON.stringify(JSON.parse(raw), null, 2);
      } catch {
        text = raw;
      }
    }

    text = text.slice(0, MAX_CHARS);

    return {
      ok: res.ok,
      url: parsed.toString(),
      title,
      text,
      status: res.status,
      error: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fetch failed";
    return { ok: false, url: parsed.toString(), title: "", text: "", error: message };
  } finally {
    clearTimeout(timer);
  }
}
