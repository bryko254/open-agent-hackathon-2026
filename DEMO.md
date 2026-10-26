# Demo script — Evidence Agent (Track 02)

90 seconds for a judge. No API key required. Heuristic mode cites live pages and explains the confidence level.

## Before you start

```bash
npm install
npm run dev
```

Open http://localhost:3000. Optional: `OPENAI_API_KEY` rewrites the prose. Optional: `GITHUB_TOKEN` (or `GH_TOKEN` / `GITHUB_PAT`) raises the GitHub Search API rate limit. The public API is used when no token is set.

`GET /api/health` should return `{ "ok": true, "synthesis": "heuristic" }` until an OpenAI key is present.

## 0:00 — What this is

Point at the Track 02 badge and the four steps: **Plan, Fetch, Cite, Explain**.

Say: the agent has to show which source it opened, quote it, and say why the confidence is high, medium, or low.

## 0:15 — Hero goal

Click **Railway + Next.js**. The goal asks how Railway's Next.js guidance lines up with the Next.js docs.

Click **Run investigation**. The server fetches the Railway Next.js guide, the Next.js docs home, and the Next.js deploying page. Expect about 10–20 seconds.

## 0:40 — Read the outcome

The outcome is two quoted sentences with **[E#]** buttons. The line under it is the confidence reason (sites, shared words, anything excluded).

Click a citation. The evidence card has a **live** badge, the quote, why that page was opened, and the URL. Open one URL and show the quote is on the page.

## 1:05 — Reasoning

The timeline is the investigation: plan (why each page), one fetch per source, notes, then synthesis. An error step stays visible. It is not dropped.

Open **Why**. It separates supporting quotes, how the sources fit, and what was left out.

## Optional second goal (if time)

**GitHub agents** — live repository search (public API, or authenticated if `GITHUB_TOKEN` is set). Cards are real `owner/repo` links unless the call fails, in which case the card is a **stub** and says so. Stars are described as popularity, not as proof from a README.

**Define the term** — Wikipedia summaries. If DuckDuckGo only repeats a page already cited, the step says it was not counted twice.

**Gmail stub** — intentional. The card is labeled stub, and confidence ignores it. See [FAILURE_MODES.md](./FAILURE_MODES.md).

## Curl (no browser)

```bash
curl -s http://localhost:3000/api/health

curl -s -X POST http://localhost:3000/api/investigate \
  -H 'content-type: application/json' \
  -d '{"goal":"What does Railway recommend for deploying a Next.js app, and how does that line up with the Next.js docs? Cite the sources and say why."}' \
  | jq '.outcome, .confidence, .confidenceReason, [.evidence[] | {id, title, live, source}]'
```

## What “good” looks like

- Outcome sentences end in citations that exist in the evidence list.
- At least two **live** cards on the hero goal, with different sites.
- Confidence reason matches those cards.
- The Gmail chip produces a stub, not a fake inbox.
