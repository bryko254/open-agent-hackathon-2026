import { keywordsFrom } from "@/lib/agent/text";
import { extractUrls, wantsEmail, wantsGithub } from "@/lib/agent/urls";
import { USER_AGENT } from "@/lib/tools/web-fetch";

export interface PlannedSource {
  url: string;
  reason: string;
}

export interface InvestigationPlan {
  sources: PlannedSource[];
  rejected: string[];
  useGmail: boolean;
  useGithub: boolean;
}

function normalize(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    if (parsed.pathname.length > 1) parsed.pathname = parsed.pathname.replace(/\/$/, "");
    return parsed.toString();
  } catch {
    return url;
  }
}

function pushUnique(list: PlannedSource[], item: PlannedSource) {
  const key = normalize(item.url);
  if (list.some((source) => normalize(source.url) === key)) return;
  list.push({ ...item, url: key });
}

function docSeeds(goal: string): PlannedSource[] {
  const hasNext = /next\.?js/i.test(goal);
  const hasRailway = /\brailway\b/i.test(goal);
  const seeds: PlannedSource[] = [];

  if (hasRailway && hasNext) {
    seeds.push({
      url: "https://docs.railway.com/guides/nextjs",
      reason:
        "The goal asks about Railway and Next.js together, so the agent opens Railway's Next.js deploy guide instead of the marketing homepage.",
    });
    seeds.push({
      url: "https://nextjs.org/docs",
      reason:
        "Official Next.js docs are the second source, so a deploy claim is not taken from the host's guide alone.",
    });
    return seeds;
  }

  if (hasRailway) {
    seeds.push({
      url: "https://docs.railway.com/quick-start",
      reason: "The goal mentions Railway, so the agent starts at the official quick start.",
    });
    seeds.push({
      url: "https://docs.railway.com/deployments/reference",
      reason: "The deployments reference is added so build and runtime claims come from deploy docs.",
    });
  }

  if (hasNext) {
    seeds.push({
      url: "https://nextjs.org/docs",
      reason: "Official Next.js docs index. The site returns markdown to this agent when it can.",
    });
    seeds.push({
      url: "https://nextjs.org/docs/app",
      reason: "App Router page, because Next.js questions usually turn on how routing is defined.",
    });
  }

  if (/\b(openai|gpt|llm)\b/i.test(goal)) {
    seeds.push({
      url: "https://platform.openai.com/docs/overview",
      reason: "The goal mentions LLMs or OpenAI, so the platform overview is a primary source.",
    });
  }

  if (/\btypescript\b/i.test(goal)) {
    seeds.push({
      url: "https://www.typescriptlang.org/docs/",
      reason: "Official TypeScript docs.",
    });
  }

  if (/\bnode\.?js\b/i.test(goal)) {
    seeds.push({
      url: "https://nodejs.org/docs/latest/api/",
      reason: "Official Node.js API docs.",
    });
  }

  return seeds;
}

/** Railway.app must not be cited from the rail-transport article. */
function railwayMisread(goal: string): string | null {
  if (!/\brailway\b/i.test(goal)) return null;
  if (!/\b(deploy|docker|nixpacks|railpack|hosting|next|app|docs|dockerfile)\b/i.test(goal)) return null;
  return "Skipped Wikipedia for the bare word Railway: that article is about rail transport, not Railway.app. Official product docs are used instead.";
}

function chooseWikiQuery(goal: string): { query?: string; reject?: string } {
  const keywords = keywordsFrom(goal);
  const has = (keyword: string) => keywords.includes(keyword);
  if (has("next.js") || has("nextjs")) return { query: "Next.js" };
  if (has("model") && has("context") && has("protocol")) return { query: "Model Context Protocol" };
  if (has("typescript")) return { query: "TypeScript" };
  if (has("openai")) return { query: "OpenAI" };
  if (railwayMisread(goal)) return {};
  return {
    reject:
      "Skipped Wikipedia: the goal did not name a single article the agent can select safely (for example Next.js or Model Context Protocol).",
  };
}

function titleMatches(title: string, goal: string, keywords: string[]): boolean {
  if (
    /^(railway|express|spring|phoenix|rocket)$/i.test(title) &&
    /\b(deploy|docs|app|hosting|framework|github)\b/i.test(goal)
  ) {
    return false;
  }
  const norm = title.toLowerCase();
  return keywords.some((keyword) => keyword.length >= 4 && norm.includes(keyword));
}

async function wikipediaSource(goal: string): Promise<{ source?: PlannedSource; rejected?: string }> {
  const decision = chooseWikiQuery(goal);
  if (decision.reject) return { rejected: decision.reject };
  if (!decision.query) return {};

  const endpoint =
    "https://en.wikipedia.org/w/api.php?action=opensearch&limit=3&namespace=0&format=json&search=" +
    encodeURIComponent(decision.query);

  try {
    const res = await fetch(endpoint, {
      cache: "no-store",
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return { rejected: `Wikipedia search failed (HTTP ${res.status}) for "${decision.query}".` };
    }
    const data = (await res.json()) as [string, string[]];
    const titles = data[1] || [];
    if (titles.length === 0) {
      return { rejected: `Wikipedia open search for "${decision.query}" returned no article.` };
    }

    const keywords = keywordsFrom(goal);
    const title = titles.find((candidate) => titleMatches(candidate, goal, keywords));
    if (!title) {
      return {
        rejected: `Wikipedia suggested "${titles[0]}" for "${decision.query}", which does not match the goal terms, so it was not fetched.`,
      };
    }

    const summaryUrl =
      "https://en.wikipedia.org/api/rest_v1/page/summary/" +
      encodeURIComponent(title.replace(/ /g, "_"));
    return {
      source: {
        url: summaryUrl,
        reason: `Wikipedia summary for "${title}" matches the goal and returns a short extract that can be quoted.`,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "request failed";
    return { rejected: `Wikipedia lookup failed (${message}).` };
  }
}

export async function planInvestigation(goal: string, webBudget: number): Promise<InvestigationPlan> {
  const budget = Math.max(1, Math.min(3, webBudget));
  const sources: PlannedSource[] = [];
  const rejected: string[] = [];

  for (const url of extractUrls(goal)) {
    pushUnique(sources, {
      url,
      reason: "The goal includes this URL, so it is fetched directly instead of guessing a source.",
    });
    if (sources.length >= budget) break;
  }

  if (sources.length < budget) {
    for (const seed of docSeeds(goal)) {
      pushUnique(sources, seed);
      if (sources.length >= budget) break;
    }
  }

  const railwayNote = railwayMisread(goal);
  if (railwayNote) rejected.push(railwayNote);

  if (sources.length < budget) {
    const wiki = await wikipediaSource(goal);
    if (wiki.source) pushUnique(sources, wiki.source);
    if (wiki.rejected) rejected.push(wiki.rejected);
  }

  return {
    sources: sources.slice(0, budget),
    rejected,
    useGmail: wantsEmail(goal),
    useGithub: wantsGithub(goal),
  };
}
