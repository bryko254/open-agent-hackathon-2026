export interface GitHubStubResult {
  connected: false;
  message: string;
  sample: {
    query: string;
    repos: Array<{ full_name: string; description: string; stars: number }>;
  };
}

/**
 * Stub GitHub connector — shows the investigation tool shape without tokens.
 */
export function githubStubSearch(query: string): GitHubStubResult {
  return {
    connected: false,
    message:
      "GitHub connector is stubbed for this demo. Add a PAT or GitHub App for live search.",
    sample: {
      query,
      repos: [
        {
          full_name: "example/stub-match",
          description: `Stub repo related to "${query.slice(0, 40)}" — not a live API result.`,
          stars: 0,
        },
      ],
    },
  };
}
