"use client";

import { useEffect, useState } from "react";
import type { InvestigationResult } from "@/lib/agent/types";

const EXAMPLES = [
  {
    label: "Railway + Next.js",
    goal: "What does Railway recommend for deploying a Next.js app, and why would a Dockerfile or Railpack matter? Cite the docs.",
  },
  {
    label: "Cite a docs URL",
    goal: "Using https://nextjs.org/docs and https://nextjs.org/docs/app, explain what the App Router is and why that definition is supported.",
  },
  {
    label: "GitHub search",
    goal: 'Which public GitHub repositories match "model context protocol", and what do the top project\'s description and README say?',
  },
  {
    label: "Honest gap",
    goal: "Check my email and GitHub for threads about the Open Agent Hackathon submission, and say what you can actually prove.",
  },
];

const STAGES = [
  "Planning sources and rejecting weak ones",
  "Fetching public pages",
  "Checking GitHub when the goal asks for it",
  "Quoting overlaps and setting confidence",
];

function statusColor(status: string) {
  switch (status) {
    case "done":
      return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30";
    case "error":
      return "bg-rose-500/15 text-rose-300 ring-rose-500/30";
    case "running":
      return "bg-amber-500/15 text-amber-300 ring-amber-500/30";
    default:
      return "bg-slate-500/15 text-slate-300 ring-slate-500/30";
  }
}

function confidenceTone(level: string) {
  if (level === "high") return "text-emerald-300";
  if (level === "medium") return "text-amber-300";
  return "text-rose-300";
}

function confidenceBar(level: string) {
  if (level === "high") return "bg-emerald-400";
  if (level === "medium") return "bg-amber-300";
  return "bg-rose-400";
}

function Cited({ text }: { text: string }) {
  const parts = text.split(/(\[E\d+\])/g);
  return (
    <>
      {parts.map((part, index) =>
        /^\[E\d+\]$/.test(part) ? (
          <a
            key={`${part}-${index}`}
            href={`#evidence-${part.slice(1, -1)}`}
            className="mx-0.5 inline-flex rounded bg-cyan-400/15 px-1.5 py-0.5 font-mono text-[11px] text-cyan-100 hover:bg-cyan-400/25"
          >
            {part}
          </a>
        ) : (
          <span key={`${index}-${part.slice(0, 12)}`}>{part}</span>
        )
      )}
    </>
  );
}

export default function InvestigationUI() {
  const [goal, setGoal] = useState(EXAMPLES[0].goal);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InvestigationResult | null>(null);

  useEffect(() => {
    if (!loading) return;
    setStage(0);
    const timer = setInterval(() => {
      setStage((current) => Math.min(current + 1, STAGES.length - 1));
    }, 1400);
    return () => clearInterval(timer);
  }, [loading]);

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/investigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || "Request failed");
      }
      setResult(data as InvestigationResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const cited = result?.evidence.filter((item) => item.supportsAnswer).length ?? 0;
  const excluded = result ? result.evidence.length - cited : 0;
  const filled = result ? (result.confidence === "high" ? 3 : result.confidence === "medium" ? 2 : 1) : 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-teal-400/10 px-3 py-1 text-xs font-medium text-teal-200 ring-1 ring-teal-400/30">
          Open Agent Hackathon 2026 · Track 02 · The Agent That Can Explain Why
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Evidence Agent</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-400 sm:text-base">
          Give it a goal. It chooses sources, drops ones that would cite the wrong thing, quotes the
          sentences that overlap the question, and says why the confidence is high, medium, or low.
          Stub connectors stay labeled and do not count as findings.
        </p>
      </header>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-xl shadow-black/20">
        <label htmlFor="goal" className="mb-2 block text-sm font-medium text-slate-200">
          Investigation goal
        </label>
        <textarea
          id="goal"
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          rows={4}
          className="w-full resize-y rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm leading-relaxed text-slate-100 outline-none ring-cyan-400/40 placeholder:text-slate-600 focus:ring-2"
          placeholder="What should the agent investigate, and what would count as proof?"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((example) => {
            const selected = goal === example.goal;
            return (
              <button
                key={example.label}
                type="button"
                onClick={() => setGoal(example.goal)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  selected
                    ? "bg-teal-400/15 text-teal-50 ring-1 ring-teal-300/40"
                    : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
                }`}
              >
                {example.label}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={run}
            disabled={loading || goal.trim().length < 3}
            className="inline-flex items-center justify-center rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Investigating…" : "Run investigation"}
          </button>
          <span className="text-xs text-slate-500">
            Start with Railway + Next.js. No API key required. GitHub search uses the public API
            unless it is rate-limited.
          </span>
        </div>
        {error && (
          <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300 ring-1 ring-rose-500/30">
            {error}
          </p>
        )}
      </section>

      {loading && (
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5" aria-live="polite">
          <h2 className="text-sm font-semibold text-white">Investigation in progress</h2>
          <p className="mt-1 text-xs text-slate-500">
            The server is doing the real trace. This list is only the expected sequence.
          </p>
          <ol className="mt-4 space-y-2">
            {STAGES.map((label, index) => (
              <li key={label} className="flex items-center gap-3 text-sm">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    index < stage ? "bg-emerald-400" : index === stage ? "animate-pulse bg-cyan-400" : "bg-white/15"
                  }`}
                />
                <span className={index === stage ? "text-slate-100" : "text-slate-500"}>{label}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {result && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-teal-300/25 bg-teal-400/[0.07] p-5">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-100">
                Concrete outcome
              </h2>
              <span className={`text-xs font-semibold uppercase tracking-wide ${confidenceTone(result.confidence)}`}>
                {result.confidence} confidence
              </span>
              <span className="inline-flex gap-1" aria-hidden>
                {[1, 2, 3].map((bar) => (
                  <span
                    key={bar}
                    className={`h-1.5 w-6 rounded-full ${bar <= filled ? confidenceBar(result.confidence) : "bg-white/10"}`}
                  />
                ))}
              </span>
            </div>
            <p className="mt-3 text-lg font-medium leading-relaxed text-white sm:text-xl">
              <Cited text={result.outcome} />
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">{result.confidenceReason}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-slate-400">
              <span className="rounded-full bg-black/20 px-2 py-1">{result.mode} synthesis</span>
              <span className="rounded-full bg-black/20 px-2 py-1">{result.durationMs} ms</span>
              <span className="rounded-full bg-black/20 px-2 py-1">{result.steps.length} steps</span>
              <span className="rounded-full bg-black/20 px-2 py-1">{cited} cited</span>
              <span className="rounded-full bg-black/20 px-2 py-1">{excluded} excluded</span>
              <span className="rounded-full bg-black/20 px-2 py-1">GitHub {result.githubMode}</span>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-5">
            <div className="space-y-6 lg:col-span-3">
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <h2 className="text-lg font-semibold text-white">Why this outcome</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Each card is a quote the agent was willing to stand behind, plus the reason that quote counts.
                </p>
                {result.claims.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-400">
                    No quote overlapped the goal. Read the gaps and the excluded evidence before trusting an answer.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {result.claims.map((claim, index) => (
                      <li key={`${claim.evidenceIds.join("-")}-${index}`} className="rounded-xl border border-white/10 bg-black/25 p-4">
                        <p className="text-sm leading-relaxed text-slate-100">
                          <Cited text={`${claim.statement} ${claim.evidenceIds.map((id) => `[${id}]`).join("")}`} />
                        </p>
                        <p className="mt-2 text-xs leading-relaxed text-slate-400">
                          <span className="font-semibold text-slate-300">Why: </span>
                          {claim.why}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <h2 className="text-lg font-semibold text-white">Evidence</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Live cards can support the outcome. Stub and no-overlap cards stay in the trace and are excluded.
                </p>
                {result.evidence.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">No evidence collected.</p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {result.evidence.map((item) => (
                      <li
                        key={item.id}
                        id={`evidence-${item.id}`}
                        className="scroll-mt-6 rounded-xl border border-white/10 bg-black/25 p-4"
                      >
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="rounded bg-cyan-400/15 px-1.5 py-0.5 font-mono text-xs text-cyan-100">
                            {item.id}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${
                              item.live
                                ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                                : "bg-amber-500/15 text-amber-200 ring-amber-500/30"
                            }`}
                          >
                            {item.live ? "Live" : "Stub"}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${
                              item.supportsAnswer
                                ? "bg-cyan-400/15 text-cyan-100 ring-cyan-300/30"
                                : "bg-white/5 text-slate-400 ring-white/10"
                            }`}
                          >
                            {item.supportsAnswer ? "Cited" : "Excluded"}
                          </span>
                          <span className="text-[11px] text-slate-500">{item.source}</span>
                        </div>
                        <p className="text-sm font-medium text-slate-100">{item.title}</p>
                        <p className="mt-2 text-xs leading-relaxed text-slate-400">{item.snippet}</p>
                        <p className="mt-2 text-xs leading-relaxed text-slate-500">
                          <span className="font-semibold text-slate-400">Why this card: </span>
                          {item.why}
                        </p>
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-block break-all text-xs text-cyan-300 hover:text-cyan-200 hover:underline"
                          >
                            {item.url}
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <details className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <summary className="cursor-pointer text-sm font-semibold text-slate-200">Full write-up</summary>
                <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-400">
                  <Cited text={result.summary} />
                </div>
              </details>
            </div>

            <aside className="space-y-6 lg:col-span-2">
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <h2 className="text-lg font-semibold text-white">Reasoning steps</h2>
                <ol className="mt-4 space-y-3">
                  {result.steps.map((step) => (
                    <li key={step.id} className="rounded-xl border border-white/10 bg-black/25 p-3">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-slate-500">#{step.index}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${statusColor(step.status)}`}
                        >
                          {step.status}
                        </span>
                        <span className="text-[11px] text-slate-500">{step.tool}</span>
                      </div>
                      <p className="text-sm font-medium text-slate-100">{step.title}</p>
                      <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-slate-500">{step.detail}</p>
                      {step.evidenceIds && step.evidenceIds.length > 0 && (
                        <p className="mt-2 text-[11px] text-cyan-300">
                          {step.evidenceIds.map((id) => `[${id}]`).join(" ")}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              </section>

              <section className="rounded-2xl border border-amber-400/20 bg-amber-500/[0.05] p-5">
                <h2 className="text-lg font-semibold text-amber-100">Gaps</h2>
                {result.limitations.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-400">No gaps recorded for this run.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {result.limitations.map((limitation) => (
                      <li key={limitation} className="text-xs leading-relaxed text-amber-50/80">
                        {limitation}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <h2 className="text-lg font-semibold text-white">Agent notes</h2>
                <ul className="mt-3 space-y-2">
                  {result.notes.map((note, index) => (
                    <li key={`${index}-${note.slice(0, 24)}`} className="whitespace-pre-wrap rounded-lg bg-black/30 px-3 py-2 text-xs leading-relaxed text-slate-400">
                      {note}
                    </li>
                  ))}
                </ul>
              </section>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}
