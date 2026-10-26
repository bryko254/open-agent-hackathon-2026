import { keywordsFrom } from "@/lib/agent/text";
import { githubStubSearch } from "@/lib/tools/github-stub";
import { USER_AGENT } from "@/lib/tools/web-fetch";

export interface GitHubHit {
  title: string;
  url: string;
  text: string;
  kind: "repo" | "readme";
}

export interface GitHubOutcome {
  mode: "live" | "stub";
  auth: "token" | "public" | "none";
  query: string;
  message: string;
  hits: GitHubHit[];
}

interface GhRepo {
  full_name?: string;
  html_url?: string;
  description?: string | null;
  stargazers_count?: number;
  language?: string | null;
}

const TOKEN_KEYS = ["GITHUB_TOKEN", "GH_TOKEN", "GITHUB_PAT"] as const;

const QUERY_STOP = [
  "github",
  "repos",
  "repo",
  "repositories",
  "repository",
  "public",
  "projects",
  "project",
  "match",
  "related",
  "which",
  "what",
  "readme",
  "description",
  "email",
  "gmail",
  "inbox",
  "threads",
  "thread",
  "check",
  "prove",
  "actually",
  "submission",
  "about",
  "using",
  "cite",
];

export function githubToken(): string | undefined {
  for (const key of TOKEN_KEYS) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

export function githubQueryFromGoal(goal: string): string {
  const quotes: string[] = [];
  const quoteRe = /"([^"]{3,80})"/g;
  let match: RegExpExecArray | null;
  while ((match = quoteRe.exec(goal))) {
    const phrase = match[1].trim();
    if (phrase) quotes.push(phrase);
  }
  if (quotes.length) return quotes.map((phrase) => `"${phrase}"`).join(" ");
  return keywordsFrom(goal, QUERY_STOP).slice(0, 6).join(" ");
}

export function githubRepoFromGoal(goal: string): { owner: string; repo: string } | null {
  const found = goal.match(/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/i);
  if (!found) return null;
  const owner = found[1];
  const repo = found[2].replace(/\.git$/i, "").replace(/[)\].,]+$/g, "");
  if (!repo || ["search", "topics", "features", "apps", "settings"].includes(owner.toLowerCase())) {
    return null;
  }
  return { owner, repo };
}

async function ghFetch(path: string, accept: string): Promise<{ ok: boolean; status: number; text: string }> {
  const token = githubToken();
  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT,
    Accept: accept,
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`https://api.github.com${path}`, {
    cache: "no-store",
    headers,
    signal: AbortSignal.timeout(12000),
  });
  return { ok: res.ok, status: res.status, text: await res.text() };
}

function stubOutcome(goal: string, query: string, auth: GitHubOutcome["auth"], reason: string): GitHubOutcome {
  const stub = githubStubSearch(goal);
  return {
    mode: "stub",
    auth,
    query,
    message: `${reason} ${stub.message}`,
    hits: [],
  };
}

function hitsFromRepos(repos: GhRepo[]): GitHubHit[] {
  const hits: GitHubHit[] = [];
  for (const repo of repos) {
    if (!repo.full_name || !repo.html_url) continue;
    const stars = repo.stargazers_count ?? 0;
    const starLabel = stars === 1 ? "star" : "stars";
    const language = repo.language ? `, mainly ${repo.language}` : "";
    const description = repo.description?.trim() || "The API returned no description.";
    hits.push({
      kind: "repo",
      title: repo.full_name,
      url: repo.html_url,
      text: `${repo.full_name} (${stars} ${starLabel}${language}) — ${description}`,
    });
  }
  return hits;
}

async function maybeReadme(goal: string, fullName: string): Promise<GitHubHit | null> {
  if (!/readme/i.test(goal)) return null;
  const res = await ghFetch(
    `/repos/${encodeURIComponent(fullName.split("/")[0])}/${encodeURIComponent(fullName.split("/")[1])}/readme`,
    "application/vnd.github.raw"
  );
  if (!res.ok) return null;
  const text = res.text.replace(/\r/g, "").trim().slice(0, 4000);
  if (text.length < 40) return null;
  return {
    kind: "readme",
    title: `README · ${fullName}`,
    url: `https://github.com/${fullName}#readme`,
    text,
  };
}

export async function investigateGithub(goal: string): Promise<GitHubOutcome> {
  const named = githubRepoFromGoal(goal);
  const query = named ? `${named.owner}/${named.repo}` : githubQueryFromGoal(goal);
  const auth: GitHubOutcome["auth"] = githubToken() ? "token" : "public";

  if (!named && query.replace(/"/g, "").trim().length < 3) {
    return stubOutcome(goal, query, "none", "No usable GitHub search terms were found in the goal.");
  }

  try {
    if (named) {
      const repo = await ghFetch(`/repos/${named.owner}/${named.repo}`, "application/vnd.github+json");
      if (!repo.ok) {
        return stubOutcome(goal, query, auth, `GitHub API returned HTTP ${repo.status} for ${query}.`);
      }
      const parsed = JSON.parse(repo.text) as GhRepo;
      const hits = hitsFromRepos([parsed]);
      if (parsed.full_name) {
        const readme = await maybeReadme(goal, parsed.full_name);
        if (readme) hits.push(readme);
      }
      return {
        mode: "live",
        auth,
        query,
        message: `Fetched ${parsed.full_name || query} from the GitHub API because the goal named that repository (${auth === "token" ? "authenticated" : "unauthenticated"}).`,
        hits,
      };
    }

    const search = await ghFetch(
      `/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=2`,
      "application/vnd.github+json"
    );
    if (!search.ok) {
      const rate =
        search.status === 403 || search.status === 429
          ? " The unauthenticated search quota is small; set GITHUB_TOKEN, GH_TOKEN, or GITHUB_PAT for a higher limit."
          : "";
      return stubOutcome(goal, query, auth, `GitHub Search API returned HTTP ${search.status} for ${query}.${rate}`);
    }

    const body = JSON.parse(search.text) as { items?: GhRepo[]; total_count?: number };
    const items = body.items || [];
    const hits = hitsFromRepos(items);
    if (items[0]?.full_name) {
      const readme = await maybeReadme(goal, items[0].full_name);
      if (readme) hits.push(readme);
    }
    const authLabel = auth === "token" ? "authenticated" : "unauthenticated public API";
    const message =
      hits.length === 0
        ? `GitHub Search API returned no repositories for ${query} (${authLabel}).`
        : `GitHub Search API returned ${body.total_count ?? hits.length} hit(s) for ${query}; citing the top result(s) via the ${authLabel}.`;
    return { mode: "live", auth, query, message, hits };
  } catch (err) {
    const message = err instanceof Error ? err.message : "request failed";
    return stubOutcome(goal, query, auth, `GitHub request failed (${message}).`);
  }
}
