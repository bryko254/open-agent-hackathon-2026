export type ToolName =
  | "web_fetch"
  | "notes_write"
  | "notes_read"
  | "gmail_stub"
  | "github_search"
  | "github_stub"
  | "wiki_summary"
  | "web_search";

export type StepStatus = "pending" | "running" | "done" | "error" | "skipped";

export interface EvidenceCitation {
  id: string;
  title: string;
  url?: string;
  snippet: string;
  source: ToolName | "memory" | "llm";
  fetchedAt: string;
  /** Why this source was opened, and whether the quote shares the goal's words. */
  why: string;
  /** False for labeled stubs. Stubs do not raise confidence. */
  live: boolean;
}

export interface AgentStep {
  id: string;
  index: number;
  tool: ToolName | "plan" | "synthesize";
  title: string;
  detail: string;
  status: StepStatus;
  startedAt?: string;
  finishedAt?: string;
  evidenceIds?: string[];
  error?: string;
}

export interface InvestigationResult {
  goal: string;
  outcome: string;
  summary: string;
  confidence: "low" | "medium" | "high";
  confidenceReason: string;
  steps: AgentStep[];
  evidence: EvidenceCitation[];
  notes: string[];
  mode: "heuristic" | "llm";
  durationMs: number;
  createdAt: string;
}

export interface InvestigateRequest {
  goal: string;
  maxSteps?: number;
}
