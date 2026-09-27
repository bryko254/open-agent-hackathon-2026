# Evidence Agent

**Open Agent Hackathon 2026 — Track 02 (Autonomous Agent)**  
Solo submission by [bryko254](https://github.com/bryko254)

> An agent that takes a **user goal**, runs a **multi-step investigation** with tools (web fetch + notes/memory; stub Gmail/GitHub connectors), and returns an **evidence-backed answer** with **citations** and a **concrete outcome**. The UI shows **reasoning steps + evidence** — not a thin chatbot.

Repo: https://github.com/bryko254/open-agent-hackathon-2026

## Track story

Chatbots answer in one shot. **Evidence Agent** investigates:

1. **Plan** — parse the goal, pick research targets  
2. **Act** — `web_fetch`, `notes_write` / `notes_read`, optional `gmail_stub` / `github_stub`  
3. **Cite** — every claim ties to `[E#]` evidence cards  
4. **Outcome** — a concrete result line + confidence + duration  

Judges can open [`FAILURE_MODES.md`](./FAILURE_MODES.md) for intentional edges (stubs, missing API key, fetch blocks).

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
cp .env.example .env.local   # optional: set OPENAI_API_KEY
npm install
npm run dev
```

Open http://localhost:3000

```bash
# health
curl -s http://localhost:3000/api/health | jq

# investigate
curl -s -X POST http://localhost:3000/api/investigate \
  -H 'content-type: application/json' \
  -d '{"goal":"Summarize Next.js docs at https://nextjs.org/docs"}' | jq '.outcome,.confidence'
```

`npm run build` must succeed (CI / Railway). Heuristic mode works **without** an API key.

### Environment

See [`.env.example`](./.env.example):

| Variable | Required | Notes |
|----------|----------|--------|
| `OPENAI_API_KEY` | No | Enables LLM synthesis (`mode: "llm"`) |
| `OPENAI_BASE_URL` | No | OpenAI-compatible proxy |
| `OPENAI_MODEL` | No | Default `gpt-4o-mini` |
| `ANTHROPIC_API_KEY` | No | Documented for future dual-provider; not required for v0.1 |

**Never commit secrets.** `.env*` is gitignored.

## Railway deploy from GitHub

1. In [Railway](https://railway.app): **New Project → Deploy from GitHub repo**  
2. Select `bryko254/open-agent-hackathon-2026`  
3. Railway will use the **Dockerfile** (`railway.toml`) or Nixpacks  
4. Set variables (optional): `OPENAI_API_KEY`  
5. Generate a public domain; confirm `https://<your-app>/api/health` returns `{ "ok": true }`  
6. Try the UI and a sample investigation  

Healthcheck path: `/api/health`.

## Project layout

```
src/
  app/
    api/health/route.ts       # liveness
    api/investigate/route.ts  # agent entry
    page.tsx                  # Evidence UI
  components/InvestigationUI.tsx
  lib/
    agent/run.ts              # multi-step loop
    agent/llm.ts              # optional OpenAI
    tools/web-fetch.ts
    tools/notes.ts
    tools/gmail-stub.ts
    tools/github-stub.ts
FAILURE_MODES.md
Dockerfile
railway.toml
```

## Submission checklist

- [x] Track 02 Autonomous Agent (goal → tools → evidence → outcome)  
- [x] UI shows reasoning steps + evidence citations  
- [x] `FAILURE_MODES.md` for judges  
- [x] Next.js App Router + TypeScript + API routes  
- [x] `/api/health`  
- [x] Railway-friendly (`Dockerfile` / nixpacks)  
- [x] `.env.example` (OpenAI + Anthropic optional note)  
- [x] MIT license  
- [x] README with track story, local run, Railway from GitHub  
- [x] No secrets in git  
- [x] `npm install && npm run build` succeeds  
- [x] Public GitHub: https://github.com/bryko254/open-agent-hackathon-2026  

## License

MIT © 2026 bryko254
