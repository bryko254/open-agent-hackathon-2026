# Failure Modes — Evidence Agent

Judges: this document is intentional. Track 02 wants an autonomous agent with honest edges, not a polished chatbot façade.

## Known / demonstrated failure modes

### 1. Missing `OPENAI_API_KEY`
- **Symptom:** Agent still runs (`mode: "heuristic"`), but synthesis is template-based rather than LLM-authored.
- **Why:** Happy path must work for demos and Railway without secrets in git.
- **Mitigation:** Set `OPENAI_API_KEY` (optional `OPENAI_BASE_URL`, `OPENAI_MODEL`). Anthropic is documented in `.env.example` for future dual-provider support; not wired in v0.1.

### 2. Web fetch blocked / timeout / non-HTML
- **Symptom:** Step `web_fetch` status `error`; confidence drops to `low`/`medium`.
- **Why:** Some sites block datacenter User-Agents, require JS, or exceed the 12s timeout / 12k char cap.
- **Mitigation:** Pass explicit public URLs in the goal; prefer docs sites; retry locally.

### 3. Gmail connector stub
- **Symptom:** `gmail_stub` returns `connected: false` with a sample hit only.
- **Why:** No OAuth secrets in this scaffold; connector seam is shown for product story.
- **Mitigation:** Wire Gmail MCP / OAuth and replace `src/lib/tools/gmail-stub.ts`.

### 4. GitHub connector stub
- **Symptom:** `github_stub` returns sample repo metadata only.
- **Why:** Same as Gmail — no PATs committed.
- **Mitigation:** Replace `src/lib/tools/github-stub.ts` with Octokit / GitHub MCP.

### 5. Goal with no URLs and weak keywords
- **Symptom:** Agent falls back to Wikipedia / Wikidata search URLs; evidence may be thin or off-topic.
- **Why:** Heuristic planner seeds research targets from keywords when no URL is given.
- **Mitigation:** Include `https://…` links in the goal, or enable LLM mode for better planning later.

### 6. Hallucination boundary
- **Symptom:** Without live evidence, summary explicitly states limited evidence rather than inventing facts.
- **Why:** Citations are required for Track 02 credibility.
- **Mitigation:** Judges should verify every `[E#]` maps to the Evidence panel.

### 7. Long-running Railway cold start
- **Symptom:** First `/api/investigate` after idle may be slow.
- **Why:** Serverless-ish cold starts + outbound fetches.
- **Mitigation:** Healthcheck at `/api/health`; Dockerfile `HEALTHCHECK` included.

## What is *not* a failure
- Running without LLM and still showing multi-step reasoning + citations from live fetches.
- Stub connectors appearing in the step timeline — that is the product surface for “tools the agent can grow into.”
