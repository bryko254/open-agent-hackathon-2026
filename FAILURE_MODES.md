# Failure Modes — Evidence Agent

Judges: this document is intentional. Track 02 asks an agent to explain why a conclusion holds. These are the edges where it should say it cannot.

## Known failure modes

### 1. Missing `OPENAI_API_KEY`

- **Symptom:** The run still finishes with `mode: "heuristic"`. The outcome is a quoted sentence plus a template explanation of confidence, not a model-written essay.
- **Why:** The demo and the Railway deploy have to work with no secrets in git.
- **Mitigation:** Set `OPENAI_API_KEY` (optional `OPENAI_BASE_URL`, `OPENAI_MODEL`). If the model replies without `[E#]` citations, the heuristic write-up is kept and a gap is recorded. Anthropic is listed in `.env.example` and is not wired.

### 2. Web fetch blocked, thin, or off-topic

- **Symptom:** The `web_fetch` step is `error`, or the card is **Live** but **Excluded**. Confidence drops.
- **Why:** Some sites block datacenter clients, render only in the browser, or return a shell of navigation. The fetcher keeps `<main>` when it exists, prefers `text/markdown` when a site offers it, and refuses pages with under 80 characters of readable text. Timeout is 12 seconds. Private hosts are blocked.
- **Mitigation:** Put a public `https://` URL in the goal. Docs sites work better than app shells.

### 3. Gmail is a stub

- **Symptom:** A card titled `STUB — Gmail mailbox was not read`, status done, **Excluded**.
- **Why:** There is no OAuth client and no mailbox token in this repo. A sample subject would look like evidence, so the agent does not invent one.
- **Mitigation:** This connector is a seam. Replacing `src/lib/tools/gmail-stub.ts` with a real Gmail client is future work, not part of this submission.

### 4. GitHub rate limit or API error

- **Symptom:** Step tool `github_stub`, status `error`, and an excluded card. `githubMode` is `"stub"`. The card does **not** name a fictional repository.
- **Why:** Unauthenticated search works until GitHub returns 403 or 429. The old build always returned a fake repo; that was worse than an honest gap.
- **Mitigation:** Set `GITHUB_TOKEN`, `GH_TOKEN`, or `GITHUB_PAT` in the environment (never in git). With a token, `githubAuth` on `/api/health` is `"token"` and search uses `Authorization: Bearer`.

### 5. Public GitHub search is real, and still shallow

- **Symptom:** `githubMode: "live"` with one or two repositories and, when the goal says "README", a README excerpt. Descriptions can be empty. Search is `sort=stars`, top two, not a full code audit.
- **Why:** A 60–90 second demo needs a citable hit, not a crawl of the network.
- **Mitigation:** Paste `https://github.com/owner/repo` in the goal to fetch that repository directly.

### 6. Wikipedia can be the wrong entity

- **Symptom:** The plan step lists a rejection instead of a Wikipedia card. The usual case is the word "Railway" on a deploy question.
- **Why:** Open search maps "Railway" to rail transport. Citing that article would be a confident wrong answer. The agent skips it and uses Railway's own docs when the goal is about deploys.
- **Mitigation:** Name the product in a phrase Wikipedia can match ("Model Context Protocol", "Next.js") or pass the docs URL yourself.

### 7. Goal with no URL and no known docs

- **Symptom:** Few or no web cards, confidence `low` or `medium`, gaps that say search returned nothing or terms did not overlap.
- **Why:** The planner no longer falls back to a Wikipedia search-results HTML page or a Wikidata dump. Those pages looked like sources and did not answer the question.
- **Mitigation:** Add an `https://` link, or use one of the sample goals in [DEMO.md](./DEMO.md).

### 8. Heuristic quotes can be narrow

- **Symptom:** The outcome is one or two sentences that share words with the goal, not a full design review. Confidence can be `high` when two sources overlap the goal even if a nuance was missed.
- **Why:** Without an API key the agent will not invent a paragraph it cannot point at. The confidence sentence says high means overlap, not that every part of the question is settled.
- **Mitigation:** Read the cited card. Set `OPENAI_API_KEY` for tighter prose. The evidence ceiling still caps confidence.

### 9. Hallucinated citations

- **Symptom:** You should not see an `[E#]` that is missing from the evidence list. LLM text that does not cite known ids is discarded.
- **Why:** A citation the panel cannot click is not a citation.
- **Mitigation:** Use the chips in the UI. They scroll to the card.

### 10. Railway cold start

- **Symptom:** The first `/api/investigate` after idle can be slow. Each run also waits on outbound fetches.
- **Why:** The container may be cold, and the agent does not answer before the fetches return.
- **Mitigation:** `GET /api/health` is the platform healthcheck. The Docker `HEALTHCHECK` uses Node's `fetch` (Alpine does not ship `wget`).

## What is not a failure

- Heuristic mode showing steps, live quotes, exclusions, and a confidence reason with no API key.
- A stub row in the timeline when Gmail is requested or GitHub is rate-limited.
- Rejecting a source in the plan and saying why.
