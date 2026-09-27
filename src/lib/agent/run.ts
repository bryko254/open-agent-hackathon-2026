import { NotesMemory } from "@/lib/tools/notes";
import { webFetch } from "@/lib/tools/web-fetch";
import { gmailStubSearch } from "@/lib/tools/gmail-stub";
import { githubStubSearch } from "@/lib/tools/github-stub";
import { chatCompletion, hasLlm } from "@/lib/agent/llm";
import { researchTargets, wantsEmail, wantsGithub } from "@/lib/agent/urls";
import type {
  AgentStep,
  EvidenceCitation,
  InvestigationResult,
} from "@/lib/agent/types";

function now() {
  return new Date().toISOString();
}

function sid(prefix: string, i: number) {
  return `${prefix}-${i}`;
}

function snippet(text: string, n = 280): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : t.slice(0, n - 1) + "…";
}

/**
 * Multi-step Evidence Agent loop:
 * plan → tool calls (web + notes + optional stubs) → synthesize with citations.
 */
export async function runInvestigation(
  goal: string,
  maxSteps = 8
): Promise<InvestigationResult> {
  const started = Date.now();
  const createdAt = now();
  const notes = new NotesMemory();
  const steps: AgentStep[] = [];
  const evidence: EvidenceCitation[] = [];
  let evidenceCounter = 0;
  const mode = hasLlm() ? "llm" : "heuristic";

  const pushStep = (
    partial: Omit<AgentStep, "id" | "index" | "status"> & {
      status?: AgentStep["status"];
    }
  ): AgentStep => {
    const step: AgentStep = {
      id: sid("step", steps.length + 1),
      index: steps.length + 1,
      status: partial.status || "running",
      ...partial,
      tool: partial.tool,
      title: partial.title,
      detail: partial.detail,
    };
    steps.push(step);
    return step;
  };

  const finish = (step: AgentStep, patch: Partial<AgentStep>) => {
    Object.assign(step, patch, { finishedAt: now() });
  };

  // --- Step 1: Plan ---
  const planStep = pushStep({
    tool: "plan",
    title: "Plan investigation",
    detail: `Goal: ${goal}`,
    startedAt: now(),
  });

  const urls = researchTargets(goal, Math.min(3, maxSteps - 3));
  const useGmail = wantsEmail(goal);
  const useGithub = wantsGithub(goal);

  notes.write(`Investigation goal: ${goal}`);
  notes.write(
    `Plan: fetch ${urls.length} source(s)` +
      (useGmail ? ", stub Gmail" : "") +
      (useGithub ? ", stub GitHub" : "") +
      `, then synthesize with citations. Mode=${mode}.`
  );

  finish(planStep, {
    status: "done",
    detail: `Planned ${urls.length} web fetch(es)` +
      (useGmail ? " + Gmail stub" : "") +
      (useGithub ? " + GitHub stub" : "") +
      `.`,
    evidenceIds: [],
  });

  // --- Web fetches ---
  for (const url of urls) {
    if (steps.length >= maxSteps - 1) break;

    const step = pushStep({
      tool: "web_fetch",
      title: `Fetch evidence: ${new URL(url).hostname}`,
      detail: url,
      startedAt: now(),
    });

    const result = await webFetch(url);
    if (result.ok && result.text) {
      evidenceCounter += 1;
      const id = `E${evidenceCounter}`;
      evidence.push({
        id,
        title: result.title,
        url: result.url,
        snippet: snippet(result.text),
        source: "web_fetch",
        fetchedAt: now(),
      });
      notes.write(`[${id}] ${result.title} — ${snippet(result.text, 160)}`);
      finish(step, {
        status: "done",
        detail: `Retrieved ${result.text.length} chars from ${result.url}`,
        evidenceIds: [id],
      });
    } else {
      notes.write(`Fetch failed for ${url}: ${result.error || "unknown"}`);
      finish(step, {
        status: "error",
        detail: `Failed: ${result.error || "unknown"}`,
        error: result.error,
      });
    }

    const noteStep = pushStep({
      tool: "notes_write",
      title: "Update investigation notes",
      detail: `Persisted findings after ${new URL(url).hostname}`,
      startedAt: now(),
      status: "done",
      finishedAt: now(),
    });
    void noteStep;
  }

  // --- Optional stubs ---
  if (useGmail && steps.length < maxSteps) {
    const step = pushStep({
      tool: "gmail_stub",
      title: "Gmail connector (stub)",
      detail: `Search mailbox for: ${goal.slice(0, 80)}`,
      startedAt: now(),
    });
    const stub = gmailStubSearch(goal);
    notes.write(`Gmail stub: ${stub.message}`);
    evidenceCounter += 1;
    const id = `E${evidenceCounter}`;
    evidence.push({
      id,
      title: "Gmail stub sample hit",
      snippet: stub.sample.hits[0]?.snippet || stub.message,
      source: "gmail_stub",
      fetchedAt: now(),
    });
    finish(step, {
      status: "done",
      detail: stub.message,
      evidenceIds: [id],
    });
  }

  if (useGithub && steps.length < maxSteps) {
    const step = pushStep({
      tool: "github_stub",
      title: "GitHub connector (stub)",
      detail: `Search repos for: ${goal.slice(0, 80)}`,
      startedAt: now(),
    });
    const stub = githubStubSearch(goal);
    notes.write(`GitHub stub: ${stub.message}`);
    evidenceCounter += 1;
    const id = `E${evidenceCounter}`;
    evidence.push({
      id,
      title: stub.sample.repos[0]?.full_name || "GitHub stub",
      snippet: stub.sample.repos[0]?.description || stub.message,
      source: "github_stub",
      fetchedAt: now(),
    });
    finish(step, {
      status: "done",
      detail: stub.message,
      evidenceIds: [id],
    });
  }

  // --- Read notes ---
  const readStep = pushStep({
    tool: "notes_read",
    title: "Read investigation memory",
    detail: "Compile notes before synthesis",
    startedAt: now(),
  });
  const allNotes = notes.read();
  finish(readStep, {
    status: "done",
    detail: `${allNotes.length} note(s) in memory`,
  });

  // --- Synthesize ---
  const synth = pushStep({
    tool: "synthesize",
    title: "Synthesize evidence-backed answer",
    detail: "Produce outcome + citations",
    startedAt: now(),
  });

  const citationBlock = evidence
    .map((e) => `[${e.id}] ${e.title}${e.url ? ` (${e.url})` : ""}: ${e.snippet}`)
    .join("\n");

  let summary = "";
  let outcome = "";

  if (mode === "llm") {
    const llmOut = await chatCompletion(
      "You are Evidence Agent. Answer using ONLY the provided evidence. Cite as [E1], [E2], etc. Return JSON with keys: outcome (1 short sentence concrete result), summary (2-4 paragraphs with citations), confidence (low|medium|high).",
      `GOAL:\n${goal}\n\nEVIDENCE:\n${citationBlock}\n\nNOTES:\n${allNotes.join("\n")}`
    );

    if (llmOut) {
      try {
        const jsonMatch = llmOut.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as {
            outcome?: string;
            summary?: string;
            confidence?: string;
          };
          outcome = parsed.outcome || "";
          summary = parsed.summary || "";
        } else {
          summary = llmOut;
          outcome = "Completed LLM synthesis over collected evidence.";
        }
      } catch {
        summary = llmOut;
        outcome = "Completed LLM synthesis over collected evidence.";
      }
    }
  }

  if (!summary) {
    const live = evidence.filter((e) => e.source === "web_fetch");
    const stubs = evidence.filter((e) =>
      e.source === "gmail_stub" || e.source === "github_stub"
    );

    outcome =
      live.length > 0
        ? `Gathered ${live.length} live web source(s) and ${stubs.length} stub connector hit(s) addressing: ${goal.slice(0, 100)}`
        : `Investigation completed with limited live evidence for: ${goal.slice(0, 100)}`;

    summary =
      `## Answer\n\n` +
      `Based on a multi-step investigation for **${goal}**, the agent collected ` +
      `${evidence.length} evidence item(s).\n\n` +
      (live.length
        ? live
            .map(
              (e) =>
                `### ${e.title}\n\n${e.snippet}\n\nCitation: [${e.id}]${e.url ? ` ${e.url}` : ""}`
            )
            .join("\n\n")
        : `_No successful web fetches — see steps for errors and FAILURE_MODES.md._`) +
      (stubs.length
        ? `\n\n### Connector stubs\n\n` +
          stubs.map((e) => `- [${e.id}] ${e.title}: ${e.snippet}`).join("\n")
        : "") +
      `\n\n### Concrete outcome\n\n${outcome}`;
  }

  const confidence =
    evidence.filter((e) => e.source === "web_fetch").length >= 2
      ? "high"
      : evidence.some((e) => e.source === "web_fetch")
        ? "medium"
        : "low";

  finish(synth, {
    status: "done",
    detail: `Synthesis complete (${mode}, confidence=${confidence})`,
    evidenceIds: evidence.map((e) => e.id),
  });

  return {
    goal,
    outcome,
    summary,
    confidence: confidence as InvestigationResult["confidence"],
    steps,
    evidence,
    notes: allNotes,
    mode,
    durationMs: Date.now() - started,
    createdAt,
  };
}
