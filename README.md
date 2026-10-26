# Evidence Agent

**Open Agent Hackathon 2026 — Track 02 ("The Agent That Can Explain Why")**  
Solo submission by [bryko254](https://github.com/bryko254)

> The agent takes a **goal**, chooses **sources** (and rejects bad ones), fetches **live text**, optionally searches **GitHub**, and returns a **quoted outcome**. Every finding has an `[E#]` card and a sentence that says **why** that card supports it. Confidence is explained. Stubs are labeled and do not count.

Repo: https://github.com/bryko254/open-agent-hackathon-2026

## Live demo

Judges start here. The app is already deployed.

1. Open https://evidence-agent-ten.vercel.app
2. Confirm https://evidence-agent-ten.vercel.app/api/health returns `{ "ok": true }`.
3. Run the prefilled **Railway + Next.js** sample.

Walkthrough: [DEMO.md](./DEMO.md). Honest edges: [FAILURE_MODES.md](./FAILURE_MODES.md). Railway hosting below is an optional alternative.

## Track story

A chatbot can sound sure. This agent has to show its work:

1. **Plan** — pick docs or URLs from the goal, and say when a source would be the wrong entity (Wikipedia's "Railway" article is rail transport, so a deploy question does not cite it).
2. **Act** — `web_fetch` public pages, `notes_write` / `notes_read`, `github_search` when the goal mentions GitHub, `gmail_stub` when it mentions mail.
3. **Cite** — quote sentences that share terms with the goal. Each quote is an `[E#]` card marked live or stub, cited or excluded.
4. **Explain** — a concrete outcome, a confidence level, and a reason. High means two independent live sources overlapped the goal. It does not mean the question is fully settled.

Heuristic mode does this with **no API key**. `OPENAI_API_KEY` rewrites the prose and cannot raise confidence above that evidence ceiling.

## Stack

- **Next.js 15** (App Router) + **TypeScript** + API routes
- **Tailwind CSS** UI
- **Railway-friendly**: `Dockerfile` (standalone output), `railway.toml`, `nixpacks.toml`
- Health: [`GET /api/health`](./src/app/api/health/route.ts)
- Investigate: [`POST /api/investigate`](./src/app/api/investigate/route.ts)
- MIT License

## Local run

```bash
git clone https://github.com/bryko254/open-agent-hackathon-2026.git
cd open-agent-hackathon-2026
cp .env.example .env.local   # optional keys; the demo runs with none
npm install
npm run dev
```

Open http://localhost:3000 and run the prefilled **Railway + Next.js** goal. Details and the other three sample goals are in [DEMO.md](./DEMO.md).

```bash
curl -s http://localhost:3000/api/health

curl -s -X POST http://localhost:3000/api/investigate \
  -H 'content-type: application/json' \
  -d '{"goal":"What does Railway recommend for deploying a Next.js app, and why would a Dockerfile or Railpack matter? Cite the docs."}'
```

`npm install && npm run build` must succeed. Heuristic mode works **without** `OPENAI_API_KEY`.

### Environment

See [`.env.example`](./.env.example). None of these belong in git.

| Variable | Required | Notes |
|----------|----------|--------|
| `OPENAI_API_KEY` | No | LLM wording. Missing key → `mode: "heuristic"`. |
| `OPENAI_BASE_URL` | No | OpenAI-compatible proxy. Default `https://api.openai.com/v1`. |
| `OPENAI_MODEL` | No | Default `gpt-4o-mini`. |
| `GITHUB_TOKEN` | No | Also accepts `GH_TOKEN` or `GITHUB_PAT`. Raises GitHub search quota. |
| `ANTHROPIC_API_KEY` | No | Documented only. Not called. |

Without a GitHub token the agent still calls the **public** Search API. If GitHub returns 403 or 429, the step is a labeled stub and no fake repository is invented. `/api/health` reports `githubAuth` as `"token"` or `"public"` and `synthesis` as `"llm"` or `"heuristic"`.

## Railway deploy (optional alternative)

The public demo is already at https://evidence-agent-ten.vercel.app. Use these steps only to host a separate copy.

1. In [Railway](https://railway.com): **New Project → Deploy from GitHub repo**.
2. Select `bryko254/open-agent-hackathon-2026`.
3. Railway uses the **Dockerfile** (`railway.toml` `builder = "DOCKERFILE"`). `nixpacks.toml` is only a fallback if the builder is switched.
4. Optional variables: `OPENAI_API_KEY`, and `GITHUB_TOKEN` (or `GH_TOKEN` / `GITHUB_PAT`). Do not commit them.
5. Generate a public domain. Confirm `https://<your-app>/api/health` returns `{ "ok": true }`.
6. Run the [DEMO.md](./DEMO.md) Railway + Next.js goal in the UI.

Healthcheck path: `/api/health`. The image `HEALTHCHECK` calls that path with Node `fetch` (the Alpine image does not include `wget`). The server listens on `PORT` (default 3000) and `HOSTNAME=0.0.0.0`.

## Project layout

```
src/
  app/
    api/health/route.ts
    api/investigate/route.ts
    page.tsx
  components/InvestigationUI.tsx
  lib/
    agent/plan.ts          # source choice and rejections
    agent/run.ts           # multi-step loop
    agent/answer.ts        # quotes, confidence, why
    agent/llm.ts           # optional OpenAI-compatible chat
    tools/web-fetch.ts
    tools/github.ts        # live API, stub on failure
    tools/github-stub.ts
    tools/gmail-stub.ts
    tools/notes.ts
DEMO.md
FAILURE_MODES.md
Dockerfile
railway.toml
```

## Submission checklist

- [x] Open https://evidence-agent-ten.vercel.app
- [x] Confirm https://evidence-agent-ten.vercel.app/api/health (`{ "ok": true }`)
- [x] Run the Railway + Next.js sample on the live app
- [x] Track 02 — The Agent That Can Explain Why (goal → tools → cited outcome → why the confidence)
- [x] UI shows reasoning steps, evidence cards, outcome, and confidence
- [x] [DEMO.md](./DEMO.md) sample goals for a 60–90s walkthrough
- [x] [FAILURE_MODES.md](./FAILURE_MODES.md) for judges
- [x] Next.js App Router + TypeScript + API routes
- [x] `/api/health` and `/api/investigate`
- [x] Railway-friendly (`Dockerfile` / `railway.toml` / nixpacks fallback)
- [x] `.env.example` for optional OpenAI and GitHub tokens
- [x] MIT license
- [x] README with track story, live demo, local run, and optional Railway deploy
- [x] No secrets in git
- [x] `npm install && npm run build` succeeds
- [x] Public GitHub: https://github.com/bryko254/open-agent-hackathon-2026

## License

MIT © 2026 bryko254
