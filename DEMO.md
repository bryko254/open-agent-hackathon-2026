# Demo — Evidence Agent (60–90 seconds)

Track 02, **The Agent That Can Explain Why**. Solo entry by [bryko254](https://github.com/bryko254).

No API key is required for the path below. Heuristic mode quotes live pages and explains the confidence score. `OPENAI_API_KEY` only changes the prose. A GitHub token is optional.

## Before you start

```bash
npm install
npm run dev
```

Open http://localhost:3000. Optional: `GET /api/health` should return `"ok": true`, `"synthesis": "heuristic"`, and `"githubAuth": "public"` (or `"token"` if a GitHub token is set).

## Walkthrough

1. Leave the goal on **Railway + Next.js** (it is prefilled) and click **Run investigation**.
2. Wait for the trace. Point at three things, in this order:
   - **Reasoning steps.** The plan says why Railway's Next.js guide and the Next.js docs were chosen. Wikipedia for the bare word "Railway" is rejected, because that article is about trains.
   - **Evidence.** Live cards are marked Cited. Each card has a quote and a "why this card" line. Citation chips in the outcome jump to the card.
   - **Concrete outcome.** One quoted sentence, a confidence meter, and a sentence that says why the score is high, medium, or low. High means two live sources overlapped the goal. It does not mean every part of the question is finished.
3. If you have time, click **GitHub search**. The agent calls the public GitHub Search API (or the authenticated API when `GITHUB_TOKEN`, `GH_TOKEN`, or `GITHUB_PAT` is set) and quotes the top repository. If the API returns 403 or 429, the step is a **labeled stub** and that card is excluded from the outcome.
4. Click **Honest gap** when you want to show the boundary. Gmail is always a stub. The outcome should refuse to invent an email.

## Sample goals

These are the same four chips as the UI.

### Railway + Next.js

```text
What does Railway recommend for deploying a Next.js app, and why would a Dockerfile or Railpack matter? Cite the docs.
```

Expect live docs, a quoted deploy sentence, and a confidence reason. No key required.

### Cite a docs URL

```text
Using https://nextjs.org/docs and https://nextjs.org/docs/app, explain what the App Router is and why that definition is supported.
```

The URLs in the goal are fetched directly. The App Router page is there so the definition is not guessed.

### GitHub search

```text
Which public GitHub repositories match "model context protocol", and what do the top project's description and README say?
```

Uses GitHub's repository search plus the README of the top hit, and a Wikipedia summary when that article matches the name. Without a token this is the unauthenticated public API. A rate-limit response becomes a labeled stub, not a fake repo name.

### Honest gap

```text
Check my email and GitHub for threads about the Open Agent Hackathon submission, and say what you can actually prove.
```

Gmail is excluded on purpose. GitHub is live only if the API responds. Confidence should stay modest when the inbox was never read.

## curl

```bash
curl -s http://localhost:3000/api/health

curl -s -X POST http://localhost:3000/api/investigate \
  -H 'content-type: application/json' \
  -d '{"goal":"What does Railway recommend for deploying a Next.js app, and why would a Dockerfile or Railpack matter? Cite the docs."}' \
  | jq '{outcome, confidence, confidenceReason, githubMode, mode}'
```

## What a judge should not see

- A made-up GitHub repository presented as a search hit.
- A Gmail subject presented as mail that was read.
- High confidence when only a stub came back.
- A Wikipedia article about trains used as a source for Railway.app.

Those cases are written up in [FAILURE_MODES.md](./FAILURE_MODES.md).
