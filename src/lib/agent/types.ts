export type ToolName =
  | "web_fetch"
  | "notes_write"
  | "notes_read"
  | "gmail_stub"
  | "github_stub";

export type StepStatus = "pending" | "running" | "done" | "error" | "skipped";

export interface EvidenceCitation {
  id: string;
  title: string;
  url?: string;
  snippet: string;
  source: ToolName | "memory" | "llm";
  fetchedAt: string;
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
