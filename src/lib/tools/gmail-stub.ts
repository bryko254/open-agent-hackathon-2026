export interface GmailStubResult {
  connected: false;
  message: string;
  sample: {
    query: string;
    hits: Array<{ subject: string; from: string; snippet: string }>;
  };
}

/**
 * Stub Gmail connector — demonstrates the connector seam without OAuth.
 * Wire real Gmail MCP / API later; judges see intentional failure mode.
 */
export function gmailStubSearch(query: string): GmailStubResult {
  return {
    connected: false,
    message:
      "Gmail connector is stubbed for this demo. Connect OAuth + scopes to search real mail.",
    sample: {
      query,
      hits: [
        {
          subject: "[stub] Matching thread for: " + query.slice(0, 60),
          from: "noreply@example.com",
          snippet:
            "Stub result only — no mailbox was accessed. See FAILURE_MODES.md.",
        },
      ],
    },
  };
}
