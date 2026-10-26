const TIMEOUT_MS = 10_000;
const UA = "EvidenceAgent/0.1 (+Open-Agent-Hackathon-2026)";

export interface ResearchHit {
  ok: boolean;
  title: string;
  url: string;
  text: string;
  error?: string;
}

export interface WikiLookup {
  ok: boolean;
  error?: string;
  pages: ResearchHit[];
}

async function fetchText(url: string): Promise<{ ok: boolean; status: number; body: string; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": UA,
        Accept: "application/json,text/plain;q=0.9,*/*;q=0.8",
      },
    });
    const body = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      body,
      error: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    return { ok: false, status: 0, body: "", error: message };
  } finally {
    clearTimeout(timer);
  }
}

/** Resolve a query to one or two Wikipedia summaries with real article URLs. */
export async function wikipediaLookup(query: string): Promise<WikiLookup> {
  const searchUrl =
    "https://en.wikipedia.org/w/api.php?action=opensearch&limit=2&namespace=0&format=json&search=" +
    encodeURIComponent(query);
  const search = await fetchText(searchUrl);
  if (!search.ok) {
    return { ok: false, error: search.error || "Wikipedia search failed", pages: [] };
  }

  let titles: string[] = [];
  let urls: string[] = [];
  try {
    const parsed = JSON.parse(search.body) as [string, string[], string[], string[]];
    titles = parsed[1] || [];
    urls = parsed[3] || [];
  } catch {
    return { ok: false, error: "Wikipedia search returned unreadable JSON", pages: [] };
  }

  if (!titles.length) {
    return {
      ok: false,
      error: `Wikipedia had no article for “${query}”.`,
      pages: [],
    };
  }

  const pages: ResearchHit[] = [];
  for (let i = 0; i < titles.length; i += 1) {
    const title = titles[i];
    const summaryUrl =
      "https://en.wikipedia.org/api/rest_v1/page/summary/" +
      encodeURIComponent(title.replace(/ /g, "_"));
    const summary = await fetchText(summaryUrl);
    if (!summary.ok) continue;
    try {
      const data = JSON.parse(summary.body) as {
        title?: string;
        extract?: string;
        content_urls?: { desktop?: { page?: string } };
        type?: string;
      };
      const text = (data.extract || "").trim();
      if (text.length < 80) continue;
      pages.push({
        ok: true,
        title: data.title || title,
        url: data.content_urls?.desktop?.page || urls[i] || summaryUrl,
        text,
      });
    } catch {
      continue;
    }
  }

  if (!pages.length) {
    return {
      ok: false,
      error: `Wikipedia listed “${titles[0]}” but the summary had too little text to cite.`,
      pages: [],
    };
  }

  return { ok: true, pages };
}

export interface InstantAnswer extends ResearchHit {
  query: string;
}

/** DuckDuckGo instant answer. Callers should drop it when the URL is already cited. */
export async function duckDuckGoAnswer(query: string): Promise<InstantAnswer> {
  const url =
    "https://api.duckduckgo.com/?format=json&no_html=1&skip_disambig=1&q=" +
    encodeURIComponent(query);
  const res = await fetchText(url);
  if (!res.ok) {
    return {
      ok: false,
      query,
      title: "",
      url: "",
      text: "",
      error: res.error || "DuckDuckGo request failed",
    };
  }

  try {
    const data = JSON.parse(res.body) as {
      Heading?: string;
      AbstractText?: string;
      AbstractURL?: string;
    };
    const text = (data.AbstractText || "").trim();
    if (text.length < 40 || !data.AbstractURL) {
      return {
        ok: false,
        query,
        title: data.Heading || "",
        url: data.AbstractURL || "",
        text: "",
        error: `DuckDuckGo had no instant answer for “${query}”.`,
      };
    }
    return {
      ok: true,
      query,
      title: data.Heading || "DuckDuckGo instant answer",
      url: data.AbstractURL,
      text,
    };
  } catch {
    return {
      ok: false,
      query,
      title: "",
      url: "",
      text: "",
      error: "DuckDuckGo returned unreadable JSON",
    };
  }
}
