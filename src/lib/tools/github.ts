import { searchQuery } from "@/lib/agent/text";
import { githubStubSearch } from "@/lib/tools/github-stub";

const TIMEOUT_MS = 10_000;

export interface GithubRepo {
  fullName: string;
  url: string;
  description: string;
  stars: number;
}

export interface GithubLookup {
  live: boolean;
  authenticated: boolean;
  query: string;
  message: string;
  repos: GithubRepo[];
}

export function githubToken(): string | null {
  const value =
    process.env.GITHUB_TOKEN ||
    process.env.GH_TOKEN ||
    process.env.GITHUB_PAT ||
    "";
  const trimmed = value.trim();
  return trimmed || null;
}

/**
 * Search public repositories. Uses a token when GITHUB_TOKEN, GH_TOKEN, or
 * GITHUB_PAT is set. Otherwise calls the public API. On failure, returns a
 * labeled stub with no invented repository.
 */
export async function githubSearch(goal: string): Promise<GithubLookup> {
  const token = githubToken();
  const query = searchQuery(goal);
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "EvidenceAgent/0.1 (+Open-Agent-Hackathon-2026)",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const endpoint =
    "https://api.github.com/search/repositories?sort=stars&order=desc&per_page=5&q=" +
    encodeURIComponent(`${query} fork:false`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(endpoint, { headers, signal: controller.signal });
    if (!res.ok) {
      return stubResult(
        query,
        Boolean(token),
        token
          ? `GitHub API returned HTTP ${res.status}. This card is a labeled stub, not a repository.`
          : `GitHub public search returned HTTP ${res.status}. No GITHUB_TOKEN is set, and the unauthenticated Search API is easy to rate-limit. This card is a labeled stub, not a repository.`
      );
    }

    const data = (await res.json()) as {
      items?: Array<{
        full_name?: string;
        html_url?: string;
        description?: string | null;
        stargazers_count?: number;
      }>;
    };

    const repos = (data.items || [])
      .map((item) => {
        const fullName = item.full_name || "";
        const url = item.html_url || (fullName ? `https://github.com/${fullName}` : "");
        if (!fullName || !url) return null;
        const stars = item.stargazers_count || 0;
        const description = (item.description || "").replace(/\s+/g, " ").trim();
        return {
          fullName,
          url,
          stars,
          description:
            description ||
            `Public repository ${fullName} with ${stars} stars. GitHub has no description text to quote.`,
        };
      })
      .filter((item): item is GithubRepo => Boolean(item));

    const readable = repos.filter(
      (repo) =>
        repo.stars >= 20 &&
        repo.description.length <= 320 &&
        !repo.description.includes("```")
    );
    const chosen = (readable.length ? readable : repos).slice(0, 2);

    if (!chosen.length) {
      return {
        live: false,
        authenticated: Boolean(token),
        query,
        message: `GitHub search for “${query}” returned no repositories. Nothing was invented in their place.`,
        repos: [],
      };
    }

    return {
      live: true,
      authenticated: Boolean(token),
      query,
      message: token
        ? `Live GitHub repository search (authenticated) for “${query}”, ordered by stars.`
        : `Live GitHub repository search for “${query}”, ordered by stars. No token was set, so this used the public API and can be rate-limited.`,
      repos: chosen,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "GitHub request failed";
    return stubResult(
      query,
      Boolean(token),
      `GitHub search failed (${message}). This card is a labeled stub, not a repository.`
    );
  } finally {
    clearTimeout(timer);
  }
}

function stubResult(
  query: string,
  authenticated: boolean,
  message: string
): GithubLookup {
  return {
    live: false,
    authenticated,
    query,
    message,
    repos: [
      {
        fullName: githubStubSearch(query).sample.repos[0]?.full_name || "stub/not-a-real-search-hit",
        url: "",
        stars: 0,
        description: message,
      },
    ],
  };
}
