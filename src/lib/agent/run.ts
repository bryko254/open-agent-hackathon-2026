import { buildAnswer, clampConfidence, type RawHit } from "@/lib/agent/answer";
import { chatCompletion, hasLlm } from "@/lib/agent/llm";
import { planInvestigation } from "@/lib/agent/plan";
import type { AgentStep, Claim, InvestigationResult } from "@/lib/agent/types";
import { investigateGithub } from "@/lib/tools/github";
import { gmailStubSearch } from "@/lib/tools/gmail-stub";
import { NotesMemory } from "@/lib/tools/notes";
import { webFetch } from "@/lib/tools/web-fetch";

function now() {
  return new Date().toISOString();
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

interface LlmAnswer {
  outcome?: string;
  summary?: string;
  confidence?: InvestigationResult["confidence"];
  claims?: Claim[];
}

function parseLlm(raw: string): LlmAnswer | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as LlmAnswer;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function knownClaims(claims: Claim[] | undefined, ids: Set<string>): Claim[] {
  if (!claims) return [];
  return claims
    .filter((claim) => claim && typeof claim.statement === "string" && Array.isArray(claim.evidenceIds))
    .map((claim) => ({
      statement: claim.statement.trim(),
      evidenceIds: claim.evidenceIds.filter((id) => ids.has(id)),
      why: typeof claim.why === "string" ? claim.why.trim() : "",
    }))
    .filter((claim) => claim.statement && claim.evidenceIds.length > 0 && claim.why);
}

/**
 * Multi-step Evidence Agent:
 * plan (including rejected sources) → fetch → optional GitHub / Gmail → cite why.
 */
export async function runInvestigation(goal: string, maxSteps = 8): Promise<InvestigationResult> {
  const started = Date.now();
  const createdAt = now();
  const notes = new NotesMemory();
  const steps: AgentStep[] = [];
  const webBudget = Math.min(3, Math.max(1, maxSteps - 4));

  const pushStep = (
    partial: Omit<AgentStep, "id" | "index" | "status"> & { status?: AgentStep["status"] }
  ): AgentStep => {
    const step: AgentStep = {
      id: `step-${steps.length + 1}`,
      index: steps.length + 1,
      status: partial.status || "running",
      tool: partial.tool,
      title: partial.title,
      detail: partial.detail,
      startedAt: partial.startedAt,
      finishedAt: partial.finishedAt,
      evidenceIds: partial.evidenceIds,
      error: partial.error,
    };
    steps.push(step);
    return step;
  };

  const finish = (step: AgentStep, patch: Partial<AgentStep>) => {
    Object.assign(step, patch, { finishedAt: now() });
  };

  const plan = await planInvestigation(goal, webBudget);
  const planDetail = [
    plan.sources.length
      ? plan.sources.map((source, index) => `${index + 1}. ${source.url}\n   ${source.reason}`).join("\n")
      : "No web URL was selected.",
    plan.rejected.length ? `Rejected:\n${plan.rejected.map((reason) => `- ${reason}`).join("\n")}` : "",
    `Gmail: ${plan.useGmail ? "requested, stub only (no OAuth)." : "not requested."}`,
    `GitHub: ${plan.useGithub ? "requested." : "not requested."}`,
  ]
    .filter(Boolean)
    .join("\n");

  const planStep = pushStep({
    tool: "plan",
    title: "Plan sources and reject weak ones",
    detail: planDetail,
    startedAt: now(),
  });
  finish(planStep, { status: "done", detail: planDetail });
  notes.write(`Goal: ${goal}`);
  notes.write(planDetail);

  const raw: RawHit[] = [];
  const limitations = [...plan.rejected];
  let evidenceCounter = 0;
  const nextId = () => {
    evidenceCounter += 1;
    return `E${evidenceCounter}`;
  };

  for (const source of plan.sources) {
    const step = pushStep({
      tool: "web_fetch",
      title: `Fetch ${hostnameOf(source.url)}`,
      detail: source.url,
      startedAt: now(),
    });
    const result = await webFetch(source.url);
    if (result.ok && result.text.trim().length >= 80) {
      const id = nextId();
      raw.push({
        id,
        title: result.title || hostnameOf(source.url),
        url: result.citationUrl || result.url,
        text: result.text,
        source: "web_fetch",
        fetchedAt: now(),
        live: true,
      });
      finish(step, {
        status: "done",
        detail: `${source.reason}\nRetrieved ${result.text.length} chars from ${result.url}.`,
        evidenceIds: [id],
      });
    } else {
      const error = result.error || "No readable text";
      limitations.push(`Fetch failed for ${source.url}: ${error}.`);
      finish(step, { status: "error", detail: `${source.reason}\nFailed: ${error}.`, error });
    }
  }

  let githubMode: InvestigationResult["githubMode"] = "skipped";
  if (plan.useGithub) {
    const github = await investigateGithub(goal);
    githubMode = github.mode;
    const step = pushStep({
      tool: github.mode === "live" ? "github_search" : "github_stub",
      title: github.mode === "live" ? "GitHub search (live API)" : "GitHub connector (labeled stub)",
      detail: github.message,
      startedAt: now(),
    });

    if (github.mode === "stub") {
      const id = nextId();
      raw.push({
        id,
        title: "STUB — GitHub was not queried successfully",
        text: github.message,
        source: "github_stub",
        fetchedAt: now(),
        live: false,
        whyHint: github.message,
      });
      finish(step, { status: "error", detail: github.message, error: github.message, evidenceIds: [id] });
    } else if (github.hits.length === 0) {
      limitations.push(github.message);
      finish(step, { status: "done", detail: github.message });
    } else {
      const ids: string[] = [];
      for (const hit of github.hits) {
        const id = nextId();
        ids.push(id);
        raw.push({
          id,
          title: hit.title,
          url: hit.url || undefined,
          text: hit.text,
          source: "github_search",
          fetchedAt: now(),
          live: true,
          forceQuote: true,
          whyHint:
            hit.kind === "readme"
              ? `The goal asks about the README. This text is the README body returned by the GitHub API for ${hit.title.replace(/^README · /, "")}.`
              : `Live GitHub API record for "${github.query}". Name, stars, and description are copied from that payload.`,
        });
      }
      finish(step, { status: "done", detail: github.message, evidenceIds: ids });
    }
  }

  if (plan.useGmail) {
    const stub = gmailStubSearch(goal);
    const id = nextId();
    raw.push({
      id,
      title: "STUB — Gmail mailbox was not read",
      text: stub.message,
      source: "gmail_stub",
      fetchedAt: now(),
      live: false,
      whyHint: stub.message,
    });
    const step = pushStep({
      tool: "gmail_stub",
      title: "Gmail connector (labeled stub)",
      detail: stub.message,
      startedAt: now(),
      status: "done",
      evidenceIds: [id],
    });
    finish(step, { status: "done", detail: stub.message, evidenceIds: [id] });
  }

  const built = buildAnswer(goal, raw, limitations);

  for (const item of built.evidence) {
    const tag = item.supportsAnswer ? "cite" : "exclude";
    notes.write(`[${item.id}] ${tag} ${item.title} — ${item.snippet}`);
  }

  const notesWrite = pushStep({
    tool: "notes_write",
    title: "Save cited and excluded notes",
    detail: `Recorded ${built.evidence.length} evidence note(s) before the write-up.`,
    startedAt: now(),
  });
  finish(notesWrite, {
    status: "done",
    detail: `Recorded ${built.evidence.length} evidence note(s): ${built.evidence.map((item) => item.id).join(", ") || "none"}.`,
  });

  const allNotes = notes.read();
  const notesRead = pushStep({
    tool: "notes_read",
    title: "Read investigation memory",
    detail: "Compile notes before the final explanation.",
    startedAt: now(),
  });
  finish(notesRead, { status: "done", detail: `${allNotes.length} note(s) in memory.` });

  let mode: InvestigationResult["mode"] = "heuristic";
  let outcome = built.outcome;
  let summary = built.summary;
  let claims = built.claims;
  let confidence = built.confidence;
  let confidenceReason = built.confidenceReason;
  const finalLimits = [...built.limitations];

  if (hasLlm()) {
    const evidenceBlock = built.evidence
      .map(
        (item) =>
          `[${item.id}] supportsAnswer=${item.supportsAnswer} ${item.title}${item.url ? ` (${item.url})` : ""}\n${item.snippet}`
      )
      .join("\n\n");
    const llmRaw = await chatCompletion(
      "You are Evidence Agent. Use ONLY the evidence. Every factual sentence must cite ids like [E1]. Ignore items with supportsAnswer=false. Return JSON with keys outcome (one concrete sentence that includes a citation), summary (markdown), confidence (low|medium|high), claims (array of {statement, evidenceIds, why}). The why field must say why that evidence supports the statement.",
      `GOAL:\n${goal}\n\nEVIDENCE:\n${evidenceBlock}\n\nNOTES:\n${allNotes.join("\n")}`
    );
    const parsed = llmRaw ? parseLlm(llmRaw) : null;
    const ids = new Set(built.evidence.map((item) => item.id));
    const llmClaims = knownClaims(parsed?.claims, ids);
    const blob = `${parsed?.outcome || ""}\n${parsed?.summary || ""}`;
    const cites = [...ids].some((id) => blob.includes(`[${id}]`)) || llmClaims.length > 0;

    if (parsed && cites) {
      mode = "llm";
      if (parsed.outcome && [...ids].some((id) => parsed.outcome!.includes(`[${id}]`))) {
        outcome = parsed.outcome.trim();
      }
      if (parsed.summary && [...ids].some((id) => parsed.summary!.includes(`[${id}]`))) {
        summary = parsed.summary.trim();
      }
      if (llmClaims.length > 0) claims = llmClaims;
      const wanted = parsed.confidence;
      if (wanted === "low" || wanted === "medium" || wanted === "high") {
        confidence = clampConfidence(wanted, built.confidence);
      }
      confidenceReason = `${built.confidenceReason} The wording came from the LLM. Confidence was not raised above the evidence ceiling (${built.confidence}).`;
    } else {
      finalLimits.push(
        "OPENAI_API_KEY is set, but the model reply was missing or did not cite [E#] ids. The heuristic explanation was kept."
      );
    }
  }

  const synth = pushStep({
    tool: "synthesize",
    title: "Explain the outcome from citations",
    detail: "Tie each finding to an evidence id and set confidence.",
    startedAt: now(),
  });
  finish(synth, {
    status: "done",
    detail: `Synthesis complete (${mode}, confidence=${confidence}).`,
    evidenceIds: built.evidence.filter((item) => item.supportsAnswer).map((item) => item.id),
  });

  return {
    goal,
    outcome,
    summary,
    confidence,
    confidenceReason,
    claims,
    limitations: finalLimits,
    steps,
    evidence: built.evidence,
    notes: notes.read(),
    mode,
    githubMode,
    durationMs: Date.now() - started,
    createdAt,
  };
}
