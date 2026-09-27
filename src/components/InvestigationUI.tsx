"use client";

import { useCallback, useState } from "react";
import type { InvestigationResult } from "@/lib/agent/types";

const EXAMPLES = [
  "What does Railway recommend for deploying a Next.js app? Cite docs.",
  "Summarize Next.js App Router from https://nextjs.org/docs and note deploy tips.",
  "Find GitHub repos and email threads about autonomous agents for hackathons.",
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

function confidenceColor(c: string) {
  if (c === "high") return "text-emerald-300";
  if (c === "medium") return "text-amber-300";
  return "text-rose-300";
}

export default function InvestigationUI() {
  const [goal, setGoal] = useState(EXAMPLES[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InvestigationResult | null>(null);

  const run = useCallback(async () => {
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
  }, [goal]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300 ring-1 ring-indigo-500/30">
          Open Agent Hackathon 2026 · Track 02 · Autonomous Agent
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Evidence Agent
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">
          Give a goal. The agent plans, fetches public sources, writes notes,
          optionally hits stub Gmail/GitHub connectors, then returns an
          evidence-backed answer with citations and a concrete outcome — not a
          thin chatbot reply.
        </p>
      </header>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-xl shadow-black/20 backdrop-blur">
        <label className="mb-2 block text-sm font-medium text-slate-300">
          Investigation goal
        </label>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={3}
          className="w-full resize-y rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none ring-indigo-500/40 placeholder:text-slate-600 focus:ring-2"
          placeholder="What should the agent investigate?"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setGoal(ex)}
              className="rounded-lg bg-white/5 px-2.5 py-1 text-left text-xs text-slate-400 transition hover:bg-white/10 hover:text-slate-200"
            >
              {ex.slice(0, 48)}…
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={run}
            disabled={loading || goal.trim().length < 3}
            className="inline-flex items-center justify-center rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Investigating…" : "Run investigation"}
          </button>
          <span className="text-xs text-slate-500">
            Works without an API key (heuristic mode). Set{" "}
            <code className="text-slate-400">OPENAI_API_KEY</code> for LLM
            synthesis.
          </span>
        </div>
        {error && (
          <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300 ring-1 ring-rose-500/30">
            {error}
          </p>
        )}
      </section>

      {result && (
        <div className="grid gap-6 lg:grid-cols-5">
          <section className="space-y-4 lg:col-span-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-semibold text-white">Outcome</h2>
                <span
                  className={`text-xs font-medium uppercase tracking-wide ${confidenceColor(result.confidence)}`}
                >
                  confidence: {result.confidence}
                </span>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-slate-400">
                  {result.mode} · {result.durationMs}ms · {result.steps.length}{" "}
                  steps
                </span>
              </div>
              <p className="text-base font-medium text-indigo-200">
                {result.outcome}
              </p>
              <div className="prose-invert mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                {result.summary}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="mb-3 text-lg font-semibold text-white">
                Evidence & citations
              </h2>
              {result.evidence.length === 0 ? (
                <p className="text-sm text-slate-500">No evidence collected.</p>
              ) : (
                <ul className="space-y-3">
                  {result.evidence.map((e) => (
                    <li
                      key={e.id}
                      className="rounded-xl border border-white/5 bg-slate-950/40 p-3"
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 font-mono text-xs text-indigo-300">
                          {e.id}
                        </span>
                        <span className="text-sm font-medium text-slate-200">
                          {e.title}
                        </span>
                        <span className="text-xs text-slate-500">{e.source}</span>
                      </div>
                      <p className="text-xs leading-relaxed text-slate-400">
                        {e.snippet}
                      </p>
                      {e.url && (
                        <a
                          href={e.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-block break-all text-xs text-indigo-400 hover:underline"
                        >
                          {e.url}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <aside className="space-y-4 lg:col-span-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="mb-3 text-lg font-semibold text-white">
                Reasoning steps
              </h2>
              <ol className="space-y-3">
                {result.steps.map((s) => (
                  <li key={s.id} className="relative pl-4">
                    <span className="absolute left-0 top-2 h-full w-px bg-white/10 last:hidden" />
                    <div className="rounded-xl border border-white/5 bg-slate-950/40 p-3">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-slate-500">
                          #{s.index}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${statusColor(s.status)}`}
                        >
                          {s.status}
                        </span>
                        <span className="text-xs text-slate-500">{s.tool}</span>
                      </div>
                      <p className="text-sm font-medium text-slate-200">
                        {s.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{s.detail}</p>
                      {s.evidenceIds && s.evidenceIds.length > 0 && (
                        <p className="mt-1 text-[11px] text-indigo-400/80">
                          evidence: {s.evidenceIds.join(", ")}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="mb-3 text-lg font-semibold text-white">
                Agent notes
              </h2>
              <ul className="space-y-2">
                {result.notes.map((n, i) => (
                  <li
                    key={i}
                    className="rounded-lg bg-slate-950/50 px-3 py-2 text-xs text-slate-400"
                  >
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
