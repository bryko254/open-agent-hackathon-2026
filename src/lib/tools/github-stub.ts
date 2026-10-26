export interface GitHubStubResult {
  connected: false;
  message: string;
  sample: {
    query: string;
    repos: Array<{ full_name: string; description: string; stars: number }>;
  };
}

/**
 * Labeled non-result used only when the GitHub API cannot be reached.
 * The sample name is deliberately not a real repository.
 */
export function githubStubSearch(query: string): GitHubStubResult {
  return {
    connected: false,
    message:
      "GitHub search did not return live data. This stub is not a repository. Set GITHUB_TOKEN (or GH_TOKEN / GITHUB_PAT) to raise the Search API rate limit.",
    sample: {
      query,
      repos: [
        {
          full_name: "stub/not-a-real-search-hit",
          description:
            "Labeled stub — no GitHub repository was returned for this query.",
          stars: 0,
        },
      ],
    },
  };
}
