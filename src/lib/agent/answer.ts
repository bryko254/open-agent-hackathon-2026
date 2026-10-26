import {
  bestSentences,
  clip,
  keywordsFrom,
  openingExcerpt,
  type ScoredSentence,
} from "@/lib/agent/text";
import type { Claim, EvidenceCitation, InvestigationResult } from "@/lib/agent/types";

export interface RawHit {
  id: string;
  title: string;
  url?: string;
  text: string;
  source: EvidenceCitation["source"];
  fetchedAt: string;
  live: boolean;
  /** Cite this hit even when the wording does not repeat the goal (API records, READMEs). */
  forceQuote?: boolean;
  whyHint?: string;
}

export interface BuiltAnswer {
  outcome: string;
  summary: string;
  confidence: InvestigationResult["confidence"];
  confidenceReason: string;
  claims: Claim[];
  limitations: string[];
  evidence: EvidenceCitation[];
}

interface DraftClaim extends Claim {
  score: number;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function buildAnswer(goal: string, hits: RawHit[], priorLimits: string[]): BuiltAnswer {
  const keywords = keywordsFrom(goal);
  const limitations = [...priorLimits];
  const evidence: EvidenceCitation[] = [];
  const drafts: DraftClaim[] = [];

  for (const hit of hits) {
    const picked = hit.live ? bestSentences(hit.text, keywords, 2) : [];
    let supportsAnswer = false;
    let why = "";
    let snippet = "";

    if (!hit.live) {
      why =
        hit.whyHint ||
        "Labeled stub. Shown so the missing connector is visible, and excluded from the outcome.";
      snippet = clip(hit.text, 360);
    } else if (picked.length > 0) {
      supportsAnswer = true;
      snippet = clip(picked.map((item) => item.sentence).join(" "), 520);
      const hitsFound = unique(picked.flatMap((item) => item.hits));
      why = `Quoted because it contains goal terms (${hitsFound.join(", ")}) in "${hit.title}".`;
      for (const item of picked) {
        drafts.push(claimFromSentence(hit, item));
      }
    } else if (hit.forceQuote && hit.text.trim()) {
      supportsAnswer = true;
      snippet = openingExcerpt(hit.text, 420);
      why =
        hit.whyHint ||
        `Quoted from "${hit.title}" because the goal asked for this record, not because every word repeats the question.`;
      drafts.push({
        statement: snippet,
        evidenceIds: [hit.id],
        why,
        score: 1,
      });
    } else {
      snippet = openingExcerpt(hit.text, 280) || "No readable text.";
      why = `Fetched "${hit.title}", but the readable text does not overlap the goal terms, so it is not used as support.`;
      limitations.push(`${hit.id} (${hit.title}) was fetched and excluded: no overlap with the goal terms.`);
    }

    if (!hit.live) {
      limitations.push(`${hit.id} (${hit.title}) is not live evidence and was excluded from the outcome.`);
    }

    evidence.push({
      id: hit.id,
      title: hit.title,
      url: hit.url,
      snippet,
      source: hit.source,
      fetchedAt: hit.fetchedAt,
      live: hit.live,
      supportsAnswer,
      why,
    });
  }

  drafts.sort((a, b) => b.score - a.score);
  const claims: Claim[] = [];
  for (const draft of drafts) {
    if (claims.some((existing) => existing.statement === draft.statement)) continue;
    claims.push({
      statement: draft.statement,
      evidenceIds: draft.evidenceIds,
      why: draft.why,
    });
    if (claims.length >= 5) break;
  }

  const supportIds = unique(claims.flatMap((claim) => claim.evidenceIds));
  let confidence = confidenceFor(supportIds.length, claims.length);
  let confidenceReason = reasonFor(confidence, supportIds);
  const askedForMail = hits.some((hit) => hit.source === "gmail_stub");
  const githubClaim = claims.find((claim) =>
    claim.evidenceIds.some((id) => hits.some((hit) => hit.id === id && hit.source === "github_search"))
  );
  const wantsRepos = /\b(github|repositor|readme)\b/i.test(goal);

  let top = claims[0];
  if (!askedForMail && wantsRepos && githubClaim) top = githubClaim;

  let outcome = top
    ? `${clip(top.statement, 280)} [${top.evidenceIds[0]}]`
    : "Nothing fetched overlapped this goal, so there is no supported outcome. Stub connectors were excluded.";

  if (askedForMail) {
    if (confidence === "high") confidence = "medium";
    confidenceReason = top
      ? "Medium at most: the mailbox was not read, so email cannot be proved. Live cards are public pages or repositories that share words with the goal, not messages from an inbox."
      : "Low because the mailbox was not read and no live public source overlapped the goal. The Gmail card is a stub and is excluded.";
    if (!top) confidence = "low";
    outcome = top
      ? `No email was read, so an inbox result is unproved. Public overlap only: ${clip(top.statement, 200)} [${top.evidenceIds[0]}]`
      : "No email was read, and no live public source overlapped the goal, so there is nothing to prove.";
  }

  const summary = renderSummary(outcome, confidenceReason, claims, limitations);

  return {
    outcome,
    summary,
    confidence,
    confidenceReason,
    claims,
    limitations,
    evidence,
  };
}

function claimFromSentence(hit: RawHit, item: ScoredSentence): DraftClaim {
  const why = `This sentence is used because it overlaps the goal on ${item.hits.join(", ")} and it is copied from "${hit.title}" [${hit.id}], not paraphrased from memory.`;
  return {
    statement: item.sentence,
    evidenceIds: [hit.id],
    why,
    score: item.score,
  };
}

function confidenceFor(sourceCount: number, claimCount: number): InvestigationResult["confidence"] {
  if (sourceCount >= 2 && claimCount >= 2) return "high";
  if (sourceCount >= 1 && claimCount >= 1) return "medium";
  return "low";
}

function reasonFor(confidence: InvestigationResult["confidence"], supportIds: string[]): string {
  if (confidence === "high") {
    return `High because ${supportIds.length} independent live sources could be quoted (${supportIds.join(", ")}). High means those sources overlap the goal. It does not mean every part of the question is settled. Stubs are not counted.`;
  }
  if (confidence === "medium") {
    return `Medium because only ${supportIds.join(", ") || "one source"} supplied a citable overlap with the goal. A second independent live source would be required for high confidence.`;
  }
  return "Low because no live source both loaded and overlapped the goal. Stub connectors are visible in the trace and are not treated as findings.";
}

function renderSummary(
  outcome: string,
  confidenceReason: string,
  claims: Claim[],
  limitations: string[]
): string {
  const lines = ["## Why this outcome", confidenceReason, "", "## Findings"];
  if (claims.length === 0) {
    lines.push("No finding passed the citation check.");
  } else {
    for (const claim of claims) {
      const cites = claim.evidenceIds.map((id) => `[${id}]`).join("");
      lines.push(`- ${claim.statement} ${cites}`);
      lines.push(`  Why: ${claim.why}`);
    }
  }
  lines.push("", "## Gaps");
  if (limitations.length === 0) lines.push("None recorded.");
  else for (const limitation of limitations) lines.push(`- ${limitation}`);
  lines.push("", "## Concrete outcome", outcome);
  return lines.join("\n");
}

const RANK = { low: 0, medium: 1, high: 2 } as const;

export function clampConfidence(
  wanted: InvestigationResult["confidence"],
  ceiling: InvestigationResult["confidence"]
): InvestigationResult["confidence"] {
  return RANK[wanted] <= RANK[ceiling] ? wanted : ceiling;
}
