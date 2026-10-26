import { wantsGithub } from "@/lib/agent/urls";
import {
  clipSentence,
  goalTerms,
  hostOf,
  overlapOf,
} from "@/lib/agent/text";
import type { EvidenceCitation } from "@/lib/agent/types";

export interface Explanation {
  outcome: string;
  summary: string;
  confidence: "low" | "medium" | "high";
  confidenceReason: string;
}

interface Scored {
  item: EvidenceCitation;
  overlap: string[];
  /** Search hits can support a goal even when the description omits the query words. */
  supports: boolean;
}

export function explainEvidence(
  goal: string,
  evidence: EvidenceCitation[],
  failedFetches: number
): Explanation {
  const terms = goalTerms(goal);
  const live = evidence.filter((item) => item.live);
  const stubs = evidence.filter((item) => !item.live);
  const scored = live.map((item) => {
    const overlap = overlapOf(item.snippet, terms);
    return {
      item,
      overlap,
      supports: overlap.length > 0 || item.source === "github_search",
    };
  });
  const strong = orderForGoal(
    goal,
    scored
      .filter((row) => row.supports)
      .sort((a, b) => b.overlap.length - a.overlap.length)
  );
  const weak = scored.filter((row) => !row.supports);
  const strongHosts = [
    ...new Set(strong.map((row) => hostOf(row.item.url)).filter(Boolean)),
  ];
  const shared = terms.filter(
    (term) => strong.filter((row) => row.overlap.includes(term)).length >= 2
  );
  const wordStrong = strong.filter((row) => row.overlap.length > 0).length;
  const githubHits = strong.filter((row) => row.item.source === "github_search").length;

  let confidence: Explanation["confidence"] = "low";
  if (strong.length >= 2 && strongHosts.length >= 2) confidence = "high";
  else if (strong.length >= 1) confidence = "medium";

  const confidenceReason = buildReason({
    confidence,
    strong: strong.length,
    hosts: strongHosts,
    shared,
    stubs: stubs.length,
    failedFetches,
    live: live.length,
    wordStrong,
    githubHits,
  });

  const outcome = buildOutcome(strong, live.length);
  const summary = renderSummary({
    outcome,
    strong,
    weak,
    stubs,
    failedFetches,
    confidenceReason,
    shared,
    hosts: strongHosts,
    githubHits,
  });

  return { outcome, summary, confidence, confidenceReason };
}

export function capConfidence(
  suggested: string | undefined,
  cap: Explanation["confidence"]
): Explanation["confidence"] {
  const rank = { low: 0, medium: 1, high: 2 } as const;
  if (suggested !== "low" && suggested !== "medium" && suggested !== "high") {
    return cap;
  }
  return rank[suggested] <= rank[cap] ? suggested : cap;
}

export function citesLiveEvidence(
  text: string,
  evidence: EvidenceCitation[]
): boolean {
  const ids = [...text.matchAll(/\[(E\d+)\]/g)].map((match) => match[1]);
  if (!ids.length) return false;
  const known = new Map(evidence.map((item) => [item.id, item]));
  return ids.every((id) => known.has(id)) && ids.some((id) => known.get(id)?.live);
}

function orderForGoal(goal: string, rows: Scored[]): Scored[] {
  if (!wantsGithub(goal)) return rows;
  return [...rows].sort((a, b) => {
    const aGit = a.item.source === "github_search" ? 0 : 1;
    const bGit = b.item.source === "github_search" ? 0 : 1;
    return aGit - bGit;
  });
}

function buildOutcome(strong: Scored[], liveCount: number): string {
  if (!strong.length) {
    if (liveCount === 0) {
      return "No live source returned text, so there is no factual outcome for this goal.";
    }
    return "Live pages were fetched, but none of the quoted lines reuse the goal's words, so they are not turned into a factual outcome.";
  }
  return strong
    .slice(0, 2)
    .map((row) => {
      const line = clipSentence(row.item.snippet, 220);
      const ended = /[.!?…]$/.test(line) ? line : `${line}.`;
      return `${ended} [${row.item.id}]`;
    })
    .join(" ");
}

function buildReason(input: {
  confidence: Explanation["confidence"];
  strong: number;
  hosts: string[];
  shared: string[];
  stubs: number;
  failedFetches: number;
  live: number;
  wordStrong: number;
  githubHits: number;
}): string {
  const hostList = input.hosts.length ? input.hosts.join(", ") : "no site hostname";
  const wordNote = input.wordStrong
    ? ` ${input.wordStrong} quote(s) reuse the goal's words${
        input.shared.length ? ` (${input.shared.join(", ")})` : ""
      }.`
    : "";
  const githubNote = input.githubHits
    ? ` ${input.githubHits} GitHub card(s) are star-ranked search hits. Stars are popularity, not a reading of the README.`
    : "";
  let reason: string;
  if (input.confidence === "high") {
    reason = `High because ${input.strong} live sources on different sites (${hostList}) support the goal.${wordNote}${githubNote}`;
  } else if (input.strong >= 2) {
    reason = `Medium because ${input.strong} sources support the goal and they share a publisher (${hostList}), so they corroborate each other without being independent publications.${wordNote}${githubNote}`;
  } else if (input.strong === 1) {
    reason = `Medium because one live source supports the goal (${hostList}). A single supporting source is not enough for high confidence.${wordNote}${githubNote}`;
  } else if (input.live > 0) {
    reason = `Low because ${input.live} live page(s) were fetched, but the quoted lines do not reuse the goal's words.`;
  } else {
    reason = "Low because no live source returned citable text.";
  }
  if (input.stubs) {
    reason += ` ${input.stubs} stub card(s) are excluded from confidence.`;
  }
  if (input.failedFetches === 1) {
    reason += " 1 fetch failed and was left as an error step.";
  } else if (input.failedFetches > 1) {
    reason += ` ${input.failedFetches} fetches failed and were left as error steps.`;
  }
  return reason;
}

function renderSummary(input: {
  outcome: string;
  strong: Scored[];
  weak: Scored[];
  stubs: EvidenceCitation[];
  failedFetches: number;
  confidenceReason: string;
  shared: string[];
  hosts: string[];
  githubHits: number;
}): string {
  const contributions = input.strong.length
    ? input.strong
        .map((row) => {
          const where = hostOf(row.item.url) || row.item.source;
          return [
            `### [${row.item.id}] ${row.item.title}`,
            "",
            row.item.why,
            "",
            `Quoted from ${where}: "${row.item.snippet}"`,
            "",
            row.overlap.length
              ? `Goal words in that quote: ${row.overlap.join(", ")}.`
              : "The quote does not reuse the goal's words. It still supports the answer as a GitHub search hit ranked by stars.",
          ].join("\n");
        })
        .join("\n\n")
    : "_No live excerpt reused the goal's words._";

  let fit: string;
  if (input.strong.length >= 2 && input.hosts.length >= 2) {
    fit = input.shared.length
      ? `These pages come from ${input.hosts.join(" and ")}. They are cited together because the quotes share: ${input.shared.join(", ")}. Each quote is still only evidence for the sentence it contains.`
      : `These pages come from ${input.hosts.join(" and ")}.${
          input.githubHits
            ? " GitHub results are included because the search query was built from the goal, not because every description repeats those words."
            : " Each one can support its own sentence. They are not treated as one document."
        }`;
  } else if (input.strong.length >= 2) {
    fit = `The supporting quotes come from ${input.hosts.join(", ") || "the same kind of source"}. Same-publisher pages can confirm wording, and they stay short of high confidence.`;
  } else if (input.strong.length === 1) {
    fit = "One supporting quote means the outcome is a single-source claim. Another independent page that used the same words would be required to raise confidence.";
  } else {
    fit = "There is no supporting quote to reconcile.";
  }

  const leftOut: string[] = [];
  if (input.weak.length) {
    leftOut.push(
      `Live but weak: ${input.weak
        .map((row) => `[${row.item.id}] ${row.item.title}`)
        .join("; ")}. Those cards stay in the evidence list because the fetch succeeded, and they are omitted from the outcome because the quote does not reuse the goal's words.`
    );
  }
  if (input.stubs.length) {
    leftOut.push(
      `Stubs: ${input.stubs
        .map((item) => `[${item.id}] ${item.title}`)
        .join("; ")}. A stub records a connector that did not access the real system.`
    );
  }
  if (input.failedFetches) {
    leftOut.push(
      `${input.failedFetches} fetch(es) failed. The step list has the error, and failed fetches are not turned into citations.`
    );
  }
  if (!leftOut.length) {
    leftOut.push("Every collected card was used as support.");
  }

  return [
    "## Why this is the answer",
    "",
    input.outcome,
    "",
    "## What each source contributes",
    "",
    contributions,
    "",
    "## How the sources fit",
    "",
    fit,
    "",
    "## Left out on purpose",
    "",
    leftOut.join(" "),
    "",
    "## Confidence",
    "",
    input.confidenceReason,
  ].join("\n");
}
