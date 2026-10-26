# Evidence Agent

**Open Agent Hackathon 2026 — Track 02 (“The Agent That Can Explain Why”)**  
Solo submission by [bryko254](https://github.com/bryko254)

> An agent that takes a **user goal**, runs a **multi-step investigation** (docs, Wikipedia, live GitHub search, notes), and returns an **evidence-backed answer**. Every claim is tied to an **[E#]** card. The answer says **why** those sources were opened, **why** the quotes support the outcome, and **why** confidence is high, medium, or low.

Repo: https://github.com/bryko254/open-agent-hackathon-2026

Judge walkthrough: [DEMO.md](./DEMO.md) (about 90 seconds). Honest limits: [FAILURE_MODES.md](./FAILURE_MODES.md).

## Track story

Chatbots answer in one shot. **Evidence Agent** has to show its work:

1. **Plan** — pick research targets and record why each one is in scope
2. **Act** — `web_fetch` (including docs embedded in page data), Wikipedia summaries, DuckDuckGo instant answers, `notes_write` / `notes_read`, live `github_search` when the API responds, labeled `gmail_stub` / `github_stub` when a connector cannot
3. **Cite** — quotes become `[E#]` cards marked **live** or **stub**
4. **Explain** — a concrete outcome, how the sources fit, what was left out, and a confidence reason

Heuristic mode does this **without** `OPENAI_API_KEY`. A key only rewrites the prose; it cannot raise confidence above what the live cards support.

## Stack

- **Next.js 15** (App Router) + **TypeScript** + API routes
- **Tailwind CSS** UI
- **Railway-friendly**: `Dockerfile` (standalone), `railway.toml`, `nixpacks.toml`
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

Open http://localhost:3000 and click **Railway + Next.js**, then **Run investigation**.

```bash
curl -s http://localhost:3000/api/health

curl -s -X POST http://localhost:3000/api/investigate \
  -H 'content-type: application/json' \
  -d '{"goal":"What does Railway recommend for deploying a Next.js app, and how does that line up with the Next.js docs? Cite the sources and say why."}'
```

`npm install && npm run build` must succeed. Heuristic mode works **without** an API key.

### Environment

See [`.env.example`](./.env.example). None of these are required.

| Variable | Required | Notes |
|----------|----------|--------|
| `OPENAI_API_KEY` | No | LLM rewrite of the explanation (`mode: "llm"`). Confidence is still capped by the evidence. |
| `OPENAI_BASE_URL` | No | OpenAI-compatible proxy |
| `OPENAI_MODEL` | No | Default `gpt-4o-mini` |
| `GITHUB_TOKEN` | No | Also accepts `GH_TOKEN` or `GITHUB_PAT`. Live search works on the public API without a token until rate limit, then a labeled stub. |
| `ANTHROPIC_API_KEY` | No | Documented only. Not called in this build. |

**Never commit secrets.** `.env*` is gitignored (`.env.example` is the template).

## How to demo

Follow [DEMO.md](./DEMO.md). Sample goals on the page:

1. **Railway + Next.js** — three live doc pages, citations, confidence reason
2. **GitHub agents** — real repository search, or a clearly labeled stub if the API fails
3. **Define the term** — Wikipedia, and DuckDuckGo is skipped when it only repeats a page already cited
4. **Gmail stub** — shows the missing mailbox instead of inventing email

## Railway deploy from GitHub

1. In [Railway](https://railway.app): **New Project → Deploy from GitHub repo**
2. Select `bryko254/open-agent-hackathon-2026`
3. Railway uses the **Dockerfile** (`railway.toml`). Nixpacks is the other config if the builder is switched.
4. Optional variables: `OPENAI_API_KEY`, `GITHUB_TOKEN`
5. Generate a public domain; confirm `https://<your-app>/api/health` returns `{ "ok": true }`
6. Run the [DEMO.md](./DEMO.md) hero goal in the UI

Healthcheck path: `/api/health`. The image healthcheck uses Node (no `wget` dependency).

## Project layout

```
src/
  app/
    api/health/route.ts
    api/investigate/route.ts
    page.tsx
  components/InvestigationUI.tsx
  lib/
    agent/run.ts            # plan → tools → cited explanation
    agent/synthesize.ts     # why / confidence from the cards
    agent/llm.ts            # optional OpenAI rewrite
    tools/web-fetch.ts
    tools/public-research.ts
    tools/github.ts         # live search, stub on failure
    tools/gmail-stub.ts
    tools/notes.ts
DEMO.md
FAILURE_MODES.md
Dockerfile
railway.toml
```

## Submission checklist

- [x] Track 02 — goal, tools, evidence, and an explanation of why
- [x] UI shows reasoning steps, evidence cards, outcome, and confidence
- [x] `DEMO.md` sample goals for a 90-second walkthrough
- [x] `FAILURE_MODES.md` for judges
- [x] Next.js App Router + TypeScript + API routes
- [x] `/api/health`
- [x] Railway-friendly (`Dockerfile` / nixpacks)
- [x] `.env.example` (OpenAI and GitHub optional; Anthropic noted as unused)
- [x] MIT license
- [x] README with track story, local run, Railway from GitHub
- [x] No secrets in git
- [x] `npm install && npm run build` succeeds
- [x] Public GitHub: https://github.com/bryko254/open-agent-hackathon-2026

## License

MIT © 2026 bryko254
