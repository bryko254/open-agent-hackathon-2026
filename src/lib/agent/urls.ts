import { searchQuery } from "@/lib/agent/text";

/** Extract http(s) URLs and choose research targets the agent can explain. */

const URL_RE = /https?:\/\/[^\s)\]>"']+/gi;

export interface PlannedSource {
  id: "web_fetch" | "wiki_summary" | "web_search";
  label: string;
  why: string;
  url?: string;
  query?: string;
}

export function extractUrls(goal: string): string[] {
  const found = goal.match(URL_RE) || [];
  return [...new Set(found.map((url) => url.replace(/[.,;:!?]+$/, "")))];
}

export function wantsEmail(goal: string): boolean {
  return /\b(e-?mail|gmail|inbox|mailbox)\b/i.test(goal);
}

export function wantsGithub(goal: string): boolean {
  return /\b(github|repos?|repositories|pull requests?|issues?|commits?)\b/i.test(
    goal
  );
}

/**
 * GitHub is a live search when the goal asks for repositories, and also when
 * the goal has no documentation URL — so an open question is not encyclopedia-only.
 * Mailbox goals stay on the Gmail stub unless they also ask for GitHub.
 */
export function shouldSearchGithub(
  goal: string,
  sources: PlannedSource[]
): boolean {
  if (wantsEmail(goal) && !wantsGithub(goal)) return false;
  if (wantsGithub(goal)) return true;
  return !sources.some((source) => source.id === "web_fetch");
}

export function planSources(goal: string, limit = 3): PlannedSource[] {
  const sources: PlannedSource[] = [];
  const push = (source: PlannedSource) => {
    if (sources.length >= limit) return;
    if (source.url && sources.some((existing) => existing.url === source.url)) {
      return;
    }
    sources.push(source);
  };

  for (const url of extractUrls(goal)) {
    let label = url;
    try {
      label = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      label = url;
    }
    push({
      id: "web_fetch",
      label,
      url,
      why: "You included this URL in the goal, so it is a primary source rather than a search guess.",
    });
  }

  const mentionsNext = /next\.?js/i.test(goal);
  const mentionsRailway = /railway/i.test(goal);
  const mentionsDeploy = /deploy|docker|dockerfile/i.test(goal);
  const mentionsOpenAi = /\b(openai|gpt|llm)\b/i.test(goal);
  const mentionsNode = /\b(typescript|node\.?js)\b/i.test(goal);

  if (mentionsRailway && mentionsNext) {
    push({
      id: "web_fetch",
      label: "Railway Next.js guide",
      url: "https://docs.railway.com/guides/nextjs",
      why: "The goal names Railway and Next.js together, so the guide that covers that pairing is the most direct page.",
    });
  } else if (mentionsRailway) {
    push({
      id: "web_fetch",
      label: "Railway quick start",
      url: "https://docs.railway.com/quick-start",
      why: "The goal is about Railway and does not name a URL, so the quick start is the canonical on-ramp.",
    });
  }

  if (mentionsNext) {
    push({
      id: "web_fetch",
      label: "Next.js docs",
      url: "https://nextjs.org/docs",
      why: "The goal asks about Next.js, so the docs home is included as the publisher's own description.",
    });
    if (mentionsDeploy || mentionsRailway) {
      push({
        id: "web_fetch",
        label: "Next.js deploying",
        url: "https://nextjs.org/docs/app/getting-started/deploying",
        why: "The goal is about deploying, so the Next.js deploying page is a tighter citation than the docs home alone.",
      });
    }
  }

  if (mentionsOpenAi) {
    push({
      id: "web_fetch",
      label: "OpenAI docs overview",
      url: "https://platform.openai.com/docs/overview",
      why: "The goal mentions OpenAI or LLMs, so the platform overview is the primary public page.",
    });
  }

  if (mentionsNode) {
    push({
      id: "web_fetch",
      label: "TypeScript docs",
      url: "https://www.typescriptlang.org/docs/",
      why: "The goal mentions TypeScript or Node, so the TypeScript handbook is the language publisher's page.",
    });
  }

  if (wantsEmail(goal) && !wantsGithub(goal)) {
    return sources.slice(0, limit);
  }

  if (sources.length < 2) {
    const query = searchQuery(goal);
    push({
      id: "wiki_summary",
      label: "Wikipedia",
      query,
      why: `The goal does not already name two primary pages, so “${query}” is looked up on Wikipedia for a citable summary.`,
    });
    push({
      id: "web_search",
      label: "DuckDuckGo instant answer",
      query,
      why: "A second public reference is checked so the answer is not a single paragraph. If it only repeats a page already cited, it is not counted twice.",
    });
  }

  return sources.slice(0, limit);
}
