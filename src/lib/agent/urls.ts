/** Extract http(s) URLs and invent sensible research targets from a goal. */

const URL_RE = /https?:\/\/[^\s)\]>"']+/gi;

const SEED_SOURCES: Array<{ match: RegExp; urls: string[]; label: string }> = [
  {
    match: /next\.?js|vercel/i,
    urls: ["https://nextjs.org/docs", "https://railway.app/docs"],
    label: "Next.js / deploy docs",
  },
  {
    match: /railway/i,
    urls: ["https://docs.railway.com/", "https://railway.app/"],
    label: "Railway docs",
  },
  {
    match: /openai|gpt|llm/i,
    urls: ["https://platform.openai.com/docs/overview"],
    label: "OpenAI docs",
  },
  {
    match: /hackathon|open.?agent/i,
    urls: ["https://github.com/bryko254/open-agent-hackathon-2026"],
    label: "Hackathon repo",
  },
  {
    match: /typescript|node\.?js/i,
    urls: ["https://nodejs.org/en/docs", "https://www.typescriptlang.org/docs/"],
    label: "Node / TypeScript docs",
  },
];

export function extractUrls(goal: string): string[] {
  const found = goal.match(URL_RE) || [];
  return [...new Set(found.map((u) => u.replace(/[.,;:!?]+$/, "")))];
}

export function researchTargets(goal: string, max = 3): string[] {
  const fromGoal = extractUrls(goal);
  if (fromGoal.length) return fromGoal.slice(0, max);

  const seeded: string[] = [];
  for (const seed of SEED_SOURCES) {
    if (seed.match.test(goal)) {
      for (const u of seed.urls) {
        if (!seeded.includes(u)) seeded.push(u);
      }
    }
  }

  if (seeded.length === 0) {
    // Generic public references when the goal has no URL
    seeded.push("https://en.wikipedia.org/wiki/Special:Search?search=" + encodeURIComponent(goal.slice(0, 80)));
    seeded.push("https://www.wikidata.org/w/api.php?action=wbsearchentities&search=" + encodeURIComponent(goal.slice(0, 60)) + "&language=en&format=json&limit=5");
  }

  return seeded.slice(0, max);
}

export function wantsEmail(goal: string): boolean {
  return /\b(email|gmail|inbox|mail)\b/i.test(goal);
}

export function wantsGithub(goal: string): boolean {
  return /\b(github|repo|pull request|PR|issue|commit)\b/i.test(goal);
}
