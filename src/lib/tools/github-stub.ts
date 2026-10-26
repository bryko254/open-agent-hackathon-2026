export interface GitHubStubResult {
  connected: false;
  message: string;
  sample: {
    query: string;
    repos: Array<{ full_name: string; description: string; stars: number }>;
  };
}

/**
 * Labeled fallback when the GitHub API cannot be used.
 * The sample list is intentionally empty so a failure cannot be quoted as a repo.
 */
export function githubStubSearch(query: string): GitHubStubResult {
  return {
    connected: false,
    message:
      "Labeled stub: no live GitHub results are available for this run. Do not treat any repository name as a finding. Set GITHUB_TOKEN, GH_TOKEN, or GITHUB_PAT if the public API is rate-limited.",
    sample: {
      query,
      repos: [],
    },
  };
}
