export type ToolName =
  | "web_fetch"
  | "notes_write"
  | "notes_read"
  | "gmail_stub"
  | "github_stub"
  | "github_search";

export type StepStatus = "pending" | "running" | "done" | "error" | "skipped";

export interface EvidenceCitation {
  id: string;
  title: string;
  url?: string;
  snippet: string;
  source: ToolName | "memory" | "llm";
  fetchedAt: string;
  live: boolean;
  /** False for stubs and for pages that do not overlap the goal. */
  supportsAnswer: boolean;
  why: string;
}

export interface Claim {
  statement: string;
  evidenceIds: string[];
  why: string;
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
  claims: Claim[];
  limitations: string[];
  steps: AgentStep[];
  evidence: EvidenceCitation[];
  notes: string[];
  mode: "heuristic" | "llm";
  githubMode: "live" | "stub" | "skipped";
  durationMs: number;
  createdAt: string;
}

export interface InvestigateRequest {
  goal: string;
  maxSteps?: number;
}
