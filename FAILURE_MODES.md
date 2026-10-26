# Failure Modes — Evidence Agent

Judges: this document is intentional. Track 02 wants an autonomous agent with honest edges.

## Known failure modes

### 1. Missing `OPENAI_API_KEY`

- **Symptom:** `mode` is `heuristic`. The explanation is assembled from quoted sentences, source reasons, and the confidence rule.
- **Why:** The demo and a Railway deploy must run with no secrets in git.
- **What still works:** Live fetches, `[E#]` cards, and a confidence reason. The model is not required for the hero path.
- **Mitigation:** Set `OPENAI_API_KEY` (optional `OPENAI_BASE_URL`, `OPENAI_MODEL`). If the model returns prose that does not cite a real live card, that prose is discarded and the heuristic explanation is kept. The model also cannot raise confidence above the evidence cap.
- **Not wired:** `ANTHROPIC_API_KEY` is documented in `.env.example` and is not called.

### 2. Web fetch blocked, thin, or timed out

- **Symptom:** Step `web_fetch` status `error`. That failure is counted in the confidence reason. It does not become a citation.
- **Why:** Some sites block this User-Agent, render only in the browser, exceed the 10s timeout, or return less than 80 characters of readable text. Private, loopback, and cloud-metadata hosts are refused on purpose.
- **Mitigation:** The hero goal uses public docs. Railway's docs site keeps the article markdown in `__NEXT_DATA__`, which this fetcher reads. A client-only page with no content payload still fails honestly.

### 3. Gmail connector stub

- **Symptom:** The **Gmail stub** chip adds a card with `live: false` and `source: gmail_stub`.
- **Why:** There is no OAuth client and no mailbox token in this repo.
- **Effect on the answer:** The stub is named under "Left out on purpose" and does not raise confidence.
- **Mitigation:** Replace `src/lib/tools/gmail-stub.ts` with a real Gmail API or MCP connector. Out of scope for this submission.

### 4. GitHub search rate limit or network failure

- **Symptom:** Step tool is `github_stub`. The card title is "GitHub stub (not a repository)" and the snippet says the search failed. `full_name` inside the tool payload is `stub/not-a-real-search-hit` so it cannot be confused with a project.
- **Why:** Unauthenticated GitHub Search has a low quota. `GITHUB_TOKEN`, `GH_TOKEN`, or `GITHUB_PAT` raises it. A token is optional and must not be committed.
- **When it works:** HTTP 200 returns real `owner/repo` URLs, descriptions, and star counts. Stars are described as popularity, not as proof that the README answers the goal.
- **Empty search:** Zero repositories produces a done step and no invented repo.

### 5. Wikipedia or DuckDuckGo miss

- **Symptom:** `wiki_summary` or `web_search` is an error step when the query has no article or no instant answer.
- **Duplicate instant answer:** If DuckDuckGo points at a host already cited (often Wikipedia), the step is **done** and creates no second card. The detail says it refused to count the same site twice.
- **Same publisher:** Two Wikipedia pages can support an answer and still leave confidence at **medium**, because they are not independent sites.

### 6. Weak quotes

- **Symptom:** A live page is fetched, but the chosen sentence does not reuse the goal's words. It stays in the evidence list and is omitted from the outcome. Confidence stays low when nothing overlaps and there is no GitHub search hit.
- **Why:** Heuristic mode quotes; it does not paraphrase a page into new facts. It can pick a dull sentence from a long document.
- **GitHub exception:** A live search hit can support a "find repositories" goal even when the description omits the query, because the query itself selected the repo. The card says that explicitly.

### 7. Goal with no URL and no known docs

- **Symptom:** The planner uses Wikipedia and DuckDuckGo, and may add GitHub search, instead of the Railway/Next.js pages.
- **Why:** Those doc URLs are selected only when the goal mentions Railway, Next.js, OpenAI, or TypeScript, or when the goal contains an `https://` link.
- **Mitigation:** Use the chips in [DEMO.md](./DEMO.md), or paste URLs into the goal.

### 8. Hallucinated model text

- **Symptom:** With an API key, a model might invent a citation.
- **Handling:** The outcome and summary are kept only when every `[E#]` exists and at least one cited card is live. Otherwise the heuristic text remains.

### 9. Railway cold start

- **Symptom:** The first `/api/investigate` after idle can be slow, on top of the outbound fetches.
- **Mitigation:** Healthcheck at `/api/health`. Image `HEALTHCHECK` calls that route with Node.

## What is working as designed

- Heuristic mode showing a multi-step timeline, live quotes, and a confidence reason.
- A stub appearing on the Gmail chip, with `live: false`.
- Refusing to double-count a DuckDuckGo blurb that points at Wikipedia.
