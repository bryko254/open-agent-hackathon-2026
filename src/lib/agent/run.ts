import { NotesMemory } from "@/lib/tools/notes";
import { webFetch } from "@/lib/tools/web-fetch";
import { gmailStubSearch } from "@/lib/tools/gmail-stub";
import { githubSearch } from "@/lib/tools/github";
import { duckDuckGoAnswer, wikipediaLookup } from "@/lib/tools/public-research";
import { chatCompletion, hasLlm } from "@/lib/agent/llm";
import {
  capConfidence,
  citesLiveEvidence,
  explainEvidence,
} from "@/lib/agent/synthesize";
import { goalTerms, hostOf, pickSupport } from "@/lib/agent/text";
import {
  planSources,
  shouldSearchGithub,
  wantsEmail,
  type PlannedSource,
} from "@/lib/agent/urls";
import type {
  AgentStep,
  EvidenceCitation,
  InvestigationResult,
  ToolName,
} from "@/lib/agent/types";

function now() {
  return new Date().toISOString();
}

function supportWhy(planWhy: string, overlap: string[]): string {
  if (overlap.length) {
    return `${planWhy} The quoted line shares these goal words: ${overlap.join(", ")}.`;
  }
  return `${planWhy} The excerpt does not reuse the goal's distinctive words, so it is weak support.`;
}

/**
 * Multi-step Evidence Agent loop:
 * plan → live sources (docs, Wikipedia, GitHub) → notes → cited explanation.
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
  let failedFetches = 0;
  const mode = hasLlm() ? "llm" : "heuristic";
  const terms = goalTerms(goal);

  const pushStep = (
    partial: Omit<AgentStep, "id" | "index" | "status"> & {
      status?: AgentStep["status"];
    }
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

  const room = () => steps.length < maxSteps - 1;

  const addEvidence = (
    draft: Omit<EvidenceCitation, "id" | "fetchedAt">
  ): EvidenceCitation => {
    evidenceCounter += 1;
    const item: EvidenceCitation = {
      ...draft,
      id: `E${evidenceCounter}`,
      fetchedAt: now(),
    };
    evidence.push(item);
    notes.write(`[${item.id}] ${item.title} — ${item.snippet}`);
    return item;
  };

  const sources = planSources(goal, 3);
  const useGmail = wantsEmail(goal);
  const useGithub = shouldSearchGithub(goal, sources);

  const planStep = pushStep({
    tool: "plan",
    title: "Plan investigation",
    detail: sources
      .map((source) => `${source.label}: ${source.why}`)
      .concat(
        useGithub
          ? [
              "GitHub search: repository results are ordered by stars, which is a popularity signal rather than proof.",
            ]
          : [],
        useGmail
          ? [
              "Gmail: the goal mentions mail, and this build will show a labeled stub because no mailbox is connected.",
            ]
          : []
      )
      .join(" "),
    startedAt: now(),
  });
  notes.write(`Investigation goal: ${goal}`);
  notes.write(`Mode: ${mode}.`);
  finish(planStep, {
    status: "done",
    detail: planStep.detail,
  });

  for (const source of sources) {
    if (!room()) break;
    if (source.id === "web_fetch" && source.url) {
      await fetchWeb(source.url, source);
    } else if (source.id === "wiki_summary" && source.query) {
      await fetchWiki(source);
    } else if (source.id === "web_search" && source.query) {
      await fetchInstant(source);
    }
  }

  if (useGithub && room()) {
    await fetchGithub();
  }

  if (useGmail && room()) {
    const step = pushStep({
      tool: "gmail_stub",
      title: "Gmail connector (labeled stub)",
      detail: "No OAuth mailbox is connected in this build.",
      startedAt: now(),
    });
    const stub = gmailStubSearch(goal);
    const item = addEvidence({
      title: "Gmail stub (no mailbox connected)",
      snippet: stub.message,
      source: "gmail_stub",
      why: "The goal mentions email. This card exists so the missing mailbox is visible. It is not a message from an inbox.",
      live: false,
    });
    finish(step, {
      status: "done",
      detail: stub.message,
      evidenceIds: [item.id],
    });
  }

  if (room()) {
    const step = pushStep({
      tool: "notes_write",
      title: "Update investigation notes",
      detail: `Stored ${notes.read().length} note(s) before synthesis.`,
      startedAt: now(),
      status: "done",
      finishedAt: now(),
    });
    void step;
  }

  if (room()) {
    const step = pushStep({
      tool: "notes_read",
      title: "Read investigation memory",
      detail: "Compile notes before synthesis",
      startedAt: now(),
    });
    const allNotes = notes.read();
    finish(step, {
      status: "done",
      detail: `${allNotes.length} note(s) in memory`,
    });
  }

  const explained = explainEvidence(goal, evidence, failedFetches);
  let summary = explained.summary;
  let outcome = explained.outcome;
  let confidence = explained.confidence;
  let confidenceReason = explained.confidenceReason;

  const synth = pushStep({
    tool: "synthesize",
    title: "Explain the answer from the citations",
    detail: "Quote supporting lines, say what was left out, and set confidence.",
    startedAt: now(),
  });

  if (mode === "llm" && evidence.some((item) => item.live)) {
    const llmOut = await chatCompletion(
      "You are Evidence Agent. Rewrite the draft so a reader can see why the citations support the outcome. Use ONLY the evidence. Every factual sentence must include a citation like [E1] that exists in the evidence. Do not treat live:false stubs as facts. If evidence is thin, say so. Return JSON with keys outcome (1-2 sentences with citations), summary (markdown with the headings '## Why this is the answer', '## What each source contributes', '## How the sources fit', '## Left out on purpose', '## Confidence'), confidence (low|medium|high).",
      `GOAL:\n${goal}\n\nEVIDENCE:\n${evidence
        .map(
          (item) =>
            `[${item.id}] live=${item.live} ${item.title}${item.url ? ` (${item.url})` : ""}\nwhy: ${item.why}\nquote: ${item.snippet}`
        )
        .join("\n\n")}\n\nDRAFT OUTCOME:\n${explained.outcome}\n\nDRAFT REASON:\n${explained.confidenceReason}`
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
          if (parsed.summary && citesLiveEvidence(parsed.summary, evidence)) {
            summary = parsed.summary;
          }
          if (parsed.outcome && citesLiveEvidence(parsed.outcome, evidence)) {
            outcome = parsed.outcome;
          }
          const capped = capConfidence(parsed.confidence, explained.confidence);
          if (parsed.confidence && capped !== parsed.confidence) {
            confidenceReason += ` The model suggested ${parsed.confidence}; the shown level is capped by the live sources.`;
          }
          confidence = capped;
        }
      } catch {
        // Heuristic explanation remains.
      }
    }
  }

  finish(synth, {
    status: "done",
    detail: `Synthesis complete (${mode}, confidence=${confidence})`,
    evidenceIds: evidence.map((item) => item.id),
  });

  return {
    goal,
    outcome,
    summary,
    confidence,
    confidenceReason,
    steps,
    evidence,
    notes: notes.read(),
    mode,
    durationMs: Date.now() - started,
    createdAt,
  };

  async function fetchWeb(url: string, source: PlannedSource) {
    const step = pushStep({
      tool: "web_fetch",
      title: `Fetch ${source.label}`,
      detail: source.why,
      startedAt: now(),
    });
    const result = await webFetch(url);
    if (result.ok && result.text) {
      const picked = pickSupport(result.text, terms);
      if (!picked.sentence) {
        failedFetches += 1;
        notes.write(`Fetch had no citable sentence: ${result.url}`);
        finish(step, {
          status: "error",
          detail: "Page loaded but no sentence was long enough to cite.",
          error: "No citable sentence",
        });
        return;
      }
      const item = addEvidence({
        title: result.title,
        url: result.url,
        snippet: picked.sentence,
        source: "web_fetch",
        why: supportWhy(source.why, picked.overlap),
        live: true,
      });
      finish(step, {
        status: "done",
        detail: `${source.why} Cited ${item.id} from ${result.url}.`,
        evidenceIds: [item.id],
      });
      return;
    }
    failedFetches += 1;
    notes.write(`Fetch failed for ${url}: ${result.error || "unknown"}`);
    finish(step, {
      status: "error",
      detail: `Failed: ${result.error || "unknown"}`,
      error: result.error,
    });
  }

  async function fetchWiki(source: PlannedSource) {
    const step = pushStep({
      tool: "wiki_summary",
      title: "Read Wikipedia summaries",
      detail: source.why,
      startedAt: now(),
    });
    const lookup = await wikipediaLookup(source.query || goal);
    if (!lookup.ok) {
      failedFetches += 1;
      finish(step, {
        status: "error",
        detail: lookup.error || "Wikipedia lookup failed",
        error: lookup.error,
      });
      return;
    }

    const ids: string[] = [];
    lookup.pages.forEach((page, index) => {
      const picked = pickSupport(page.text, terms);
      const sentence = picked.sentence || page.text.slice(0, 280);
      const item = addEvidence({
        title: page.title,
        url: page.url,
        snippet: sentence,
        source: "wiki_summary",
        why: supportWhy(
          index === 0
            ? source.why
            : "Second Wikipedia hit for the same query. It is the same publisher, so it cannot by itself make confidence high.",
          picked.overlap
        ),
        live: true,
      });
      ids.push(item.id);
    });
    finish(step, {
      status: "done",
      detail: `Cited ${ids.join(", ")} for “${source.query}”.`,
      evidenceIds: ids,
    });
  }

  async function fetchInstant(source: PlannedSource) {
    const step = pushStep({
      tool: "web_search",
      title: "Check DuckDuckGo instant answer",
      detail: source.why,
      startedAt: now(),
    });
    const answer = await duckDuckGoAnswer(source.query || goal);
    if (!answer.ok) {
      failedFetches += 1;
      finish(step, {
        status: "error",
        detail: answer.error || "No instant answer",
        error: answer.error,
      });
      return;
    }

    const host = hostOf(answer.url);
    const already = evidence.find((item) => item.live && host && hostOf(item.url) === host);
    if (already) {
      notes.write(
        `DuckDuckGo instant answer points at ${answer.url}, already covered by ${already.id}. Not counted twice.`
      );
      finish(step, {
        status: "done",
        detail: `Skipped as a new citation. The instant answer points at ${answer.url}, and ${already.id} already cites that site. Counting it again would look like a second source.`,
      });
      return;
    }

    const picked = pickSupport(answer.text, terms);
    const item = addEvidence({
      title: answer.title,
      url: answer.url,
      snippet: picked.sentence || answer.text,
      source: "web_search",
      why: supportWhy(
        "DuckDuckGo's instant answer is a short public abstract, included because its URL is not already in the evidence.",
        picked.overlap
      ),
      live: true,
    });
    finish(step, {
      status: "done",
      detail: `Cited ${item.id} from ${answer.url}.`,
      evidenceIds: [item.id],
    });
  }

  async function fetchGithub() {
    const lookup = await githubSearch(goal);
    const tool: ToolName = lookup.live ? "github_search" : "github_stub";
    const step = pushStep({
      tool,
      title: lookup.live ? "Search GitHub repositories" : "GitHub connector (labeled stub)",
      detail: lookup.message,
      startedAt: now(),
    });

    if (!lookup.repos.length) {
      finish(step, {
        status: "done",
        detail: lookup.message,
      });
      return;
    }

    const ids: string[] = [];
    for (const repo of lookup.repos) {
      const quote = `${repo.description} ${repo.stars} stars.`;
      const picked = pickSupport(quote, terms);
      const item = addEvidence({
        title: lookup.live ? repo.fullName : "GitHub stub (not a repository)",
        url: repo.url || undefined,
        snippet: lookup.live ? quote : lookup.message,
        source: tool,
        why: lookup.live
          ? supportWhy(
              `Selected from a star-sorted GitHub search for “${lookup.query}”. Stars measure popularity, not whether the README answers the goal.`,
              picked.overlap
            )
          : lookup.message,
        live: lookup.live,
      });
      ids.push(item.id);
    }
    finish(step, {
      status: "done",
      detail: lookup.message,
      evidenceIds: ids,
    });
  }
}
