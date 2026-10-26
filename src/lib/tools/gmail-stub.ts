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
      "Labeled stub: no mailbox was accessed. Gmail OAuth is not configured, so there are no email findings. A sample subject is not evidence.",
    sample: {
      query,
      hits: [
        {
          subject: "[stub] No mailbox was read",
          from: "not-a-real-sender@example.com",
          snippet:
            "Stub result only. No inbox was queried. See FAILURE_MODES.md.",
        },
      ],
    },
  };
}
