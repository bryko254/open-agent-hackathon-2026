"use client";

import { useCallback, useState } from "react";
import { DEMO_GOALS } from "@/lib/agent/examples";
import type { InvestigationResult } from "@/lib/agent/types";

const LOOP = [
  ["Plan", "Choose sources and say why each one is in scope."],
  ["Fetch", "Open docs, Wikipedia, or GitHub. Failures stay on the timeline."],
  ["Cite", "Every card is an [E#]. Stubs are labeled and do not raise confidence."],
  ["Explain", "The outcome quotes those cards and states why the confidence is that level."],
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

function confidenceColor(level: string) {
  if (level === "high") return "text-emerald-300";
  if (level === "medium") return "text-amber-300";
  return "text-rose-300";
}

function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[E\d+\])/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-slate-100">
          {part.slice(2, -2)}
        </strong>
      );
    }
    const cite = part.match(/^\[(E\d+)\]$/);
    if (cite) {
      return (
        <button
          key={index}
          type="button"
          onClick={() =>
            document
              .getElementById(`ev-${cite[1]}`)
              ?.scrollIntoView({ behavior: "smooth", block: "center" })
          }
          className="mx-0.5 rounded bg-indigo-500/20 px-1 font-mono text-[11px] text-indigo-300 hover:bg-indigo-500/30"
        >
          {cite[1]}
        </button>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

function Answer({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-3 text-sm leading-relaxed text-slate-300">
      {blocks.map((block, index) => {
        if (block.startsWith("## ")) {
          return (
            <h3 key={index} className="pt-2 text-base font-semibold text-white">
              {block.slice(3)}
            </h3>
          );
        }
        if (block.startsWith("### ")) {
          return (
            <h4 key={index} className="font-semibold text-slate-100">
              <RichText text={block.slice(4)} />
            </h4>
          );
        }
        const lines = block.split("\n").filter(Boolean);
        if (lines.length && lines.every((line) => line.startsWith("> "))) {
          return (
            <blockquote
              key={index}
              className="border-l-2 border-indigo-400/40 pl-3 text-slate-400"
            >
              {lines.map((line) => (
                <p key={line}>
                  <RichText text={line.slice(2)} />
                </p>
              ))}
            </blockquote>
          );
        }
        return (
          <p key={index}>
            {lines.map((line, lineIndex) => (
              <span key={`${index}-${lineIndex}`}>
                {lineIndex > 0 && <br />}
                <RichText text={line} />
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export default function InvestigationUI() {
  const [goal, setGoal] = useState<string>(DEMO_GOALS[0].goal);
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
      <header className="space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300 ring-1 ring-indigo-500/30">
          Open Agent Hackathon 2026 · Track 02 · The agent that can explain why
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Evidence Agent
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-400 sm:text-base">
          Give it a goal. It plans sources, fetches them, and returns a concrete
          outcome with <span className="text-slate-200">[E#]</span> citations
          and a confidence level with a reason.
        </p>
        <ol className="grid gap-3 sm:grid-cols-4">
          {LOOP.map(([title, detail], index) => (
            <li
              key={title}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-300">
                {index + 1}. {title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{detail}</p>
            </li>
          ))}
        </ol>
      </header>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-xl shadow-black/20">
        <label htmlFor="goal" className="mb-2 block text-sm font-medium text-slate-200">
          Investigation goal
        </label>
        <textarea
          id="goal"
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          rows={3}
          className="w-full resize-y rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none ring-indigo-500/40 placeholder:text-slate-600 focus:ring-2"
          placeholder="What should the agent investigate, and which sources should it cite?"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {DEMO_GOALS.map((example) => (
            <button
              key={example.label}
              type="button"
              onClick={() => setGoal(example.goal)}
              className={`rounded-lg px-2.5 py-1 text-xs transition ${
                goal === example.goal
                  ? "bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-400/40"
                  : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
              }`}
            >
              {example.label}
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
            Heuristic mode works with no API key.{" "}
            <code className="text-slate-400">OPENAI_API_KEY</code> rewrites the
            explanation. <code className="text-slate-400">GITHUB_TOKEN</code> is
            optional.
          </span>
        </div>
        {loading && (
          <p className="mt-3 text-xs text-slate-400">
            The loop runs on the server. Steps, citations, and the outcome appear
            together when the fetches finish. Public pages usually take 10–20 seconds.
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300 ring-1 ring-rose-500/30">
            {error}
          </p>
        )}
      </section>

      {result && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-indigo-400/20 bg-indigo-500/[0.07] p-5">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold text-white">Outcome</h2>
              <span
                className={`text-xs font-semibold uppercase tracking-wide ${confidenceColor(result.confidence)}`}
              >
                confidence: {result.confidence}
              </span>
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-slate-400">
                {result.mode} · {(result.durationMs / 1000).toFixed(1)}s ·{" "}
                {result.steps.length} steps · {result.evidence.length} cards
              </span>
            </div>
            <p className="text-base font-medium leading-relaxed text-indigo-100">
              <RichText text={result.outcome} />
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              {result.confidenceReason}
            </p>
          </section>

          <div className="grid gap-6 lg:grid-cols-5">
            <section className="space-y-3 lg:col-span-3">
              <h2 className="text-lg font-semibold text-white">Evidence</h2>
              {result.evidence.length === 0 ? (
                <p className="text-sm text-slate-500">No evidence collected.</p>
              ) : (
                <ul className="space-y-3">
                  {result.evidence.map((item) => (
                    <li
                      key={item.id}
                      id={`ev-${item.id}`}
                      className="rounded-xl border border-white/10 bg-slate-950/40 p-4"
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 font-mono text-xs text-indigo-300">
                          {item.id}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${
                            item.live
                              ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                              : "bg-amber-500/15 text-amber-200 ring-amber-500/30"
                          }`}
                        >
                          {item.live ? "live" : "stub"}
                        </span>
                        <span className="text-xs text-slate-500">{item.source}</span>
                      </div>
                      <p className="text-sm font-medium text-slate-100">{item.title}</p>
                      <p className="mt-2 text-sm leading-relaxed text-slate-300">
                        {item.snippet}
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-slate-500">
                        {item.why}
                      </p>
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block break-all text-xs text-indigo-400 hover:underline"
                        >
                          {item.url}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <aside className="lg:col-span-2">
              <h2 className="mb-3 text-lg font-semibold text-white">Reasoning</h2>
              <ol className="space-y-3">
                {result.steps.map((step) => (
                  <li key={step.id}>
                    <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-slate-500">
                          #{step.index}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${statusColor(step.status)}`}
                        >
                          {step.status}
                        </span>
                        <span className="text-xs text-slate-500">{step.tool}</span>
                      </div>
                      <p className="text-sm font-medium text-slate-200">{step.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        {step.detail}
                      </p>
                      {step.evidenceIds && step.evidenceIds.length > 0 && (
                        <p className="mt-1 font-mono text-[11px] text-indigo-300/90">
                          {step.evidenceIds.join(" ")}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </aside>
          </div>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="mb-3 text-lg font-semibold text-white">Why</h2>
            <Answer text={result.summary} />
          </section>

          <details className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <summary className="cursor-pointer text-sm font-medium text-slate-300">
              Agent notes ({result.notes.length})
            </summary>
            <ul className="mt-3 space-y-2">
              {result.notes.map((note, index) => (
                <li
                  key={`${index}-${note.slice(0, 24)}`}
                  className="rounded-lg bg-slate-950/50 px-3 py-2 text-xs text-slate-400"
                >
                  {note}
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </div>
  );
}
