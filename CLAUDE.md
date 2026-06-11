# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

KnowThyHealth is a demographically-filtered, evidence-graded wellness research surface. A user supplies a profile (gender + age required; symptoms, diet, activity, sleep, and an optional condition refine it) and gets back top-N recommendation cards drawn from current literature, each **graded by strength of evidence** and grouped by wellness domain. The product thesis: studies are run on defined populations, but findings get over-extrapolated downstream — KnowThyHealth re-narrows research back to who it actually studied.

Monorepo with two independently-deployed apps:
- `frontend/` — React 18 + Vite 6 + TypeScript + Tailwind 3 (deploys to Vercel)
- `backend/` — Node 22 + Express 4, stateless API (deploys to Railway)

There is no database, no sessions, no PII persistence. The `README.md` at the repo root is a frontend design-system handoff doc; **parts are stale** (it describes feature/page components as "not yet built" — they exist). The code is the source of truth; `backend/README.md` is accurate and current.

## Commands

```bash
# Frontend (run from frontend/)
npm run dev        # Vite dev server on :5173
npm run build      # production build
npm run preview    # preview the build

# Backend (run from backend/)
npm run dev        # nodemon auto-reload on :3000
npm start          # node server.js
npm run ping:anthropic   # smoke-test the Anthropic key
npm run ping:tavily      # smoke-test the Tavily key
```

There is no test runner, linter, or typecheck script wired up — the only automated checks are the two `ping:*` key smoke-tests. `frontend/tsconfig.json` governs TS; type errors surface at `npm run build`.

### Environment
- **Backend** (`backend/.env`, copy from `.env.example`): `ANTHROPIC_API_KEY` and `TAVILY_API_KEY` are required; `CORS_ORIGIN` (default `http://localhost:5173`), `PORT` (default 3000), `NODE_ENV`.
- **Frontend**: `VITE_API_BASE_URL` points at the backend (defaults to `http://localhost:3000` in the stream client). Set in `frontend/.env.local` locally, Vercel env vars in prod.

## Backend architecture — the advice pipeline

One endpoint, two equivalent forms. Both run the **same six-step pipeline** with identical error→envelope mapping; they differ only in how Call 2 is delivered:
- `POST /api/v1/advice` — buffered JSON (`adviceController.js`)
- `POST /api/v1/advice/stream` — Server-Sent Events, Call 2 streamed card-by-card (`adviceStreamController.js`). **This is what the frontend uses.**
- `GET /healthz` — liveness probe, not part of the contract.

Pipeline (see `src/controllers/`):
1. **validate** (`inputValidator.js`) — gender + age required, everything else optional; sanitises + injection-checks. Throws `ValidationError` → 400. In the stream controller this runs *before* switching to SSE, so a bad request still returns a normal JSON 400.
2. **Call 1 — intake** (`intakeProcessor.js`, model `claude-sonnet-4-6`) — **always fires**. Turns the profile into wellness *research targets* + (if a condition was disclosed) a normalised clinical category. On any failure (incl. 429) it **degrades to `intakeContext = null`** rather than failing the request.
3. **Tavily retrieval** (`citationFetcher.js`) — up to 5 parallel queries seeded by research targets + demographic spine, restricted to a PubMed/NIH/Mayo/Harvard/Cochrane allowlist. **Never throws**; on failure returns `[]` and sets `tavilyFailed`. This citation set is the **sole source of truth for citation URLs**.
4. **Call 2 — readout** (`adviceGenerator.js`, model `claude-haiku-4-5`) — produces the domain-grouped graded cards. **No degradation here**: 429 → `RateLimitError` (→429), anything else → `AdviceGenerationError` (→503).
5. **citation validation** (`citationValidator.js`) — strips any citation URL Claude returned that isn't in the Tavily set, normalises citation-type pills, downgrades emptied cards to grade **F**. Never throws.
6. **respond** — 200 with the cleaned payload.

Error→HTTP mapping is centralised on the error classes in `src/utils/errors.js`: `ValidationError`→400, `RateLimitError`→429, `AdviceGenerationError`→503, anything uncaught→500 via the global handler in `server.js`.

### Streaming specifics (Option B: verified-card streaming)
`generateAdviceStream` partial-parses the JSON as Claude writes it and emits each card **the moment its object closes** (detected when a later card has started). The controller runs that card through `validateCard` *before* sending it down — so the UI never displays an unvalidated citation. The final `done` event carries the full schema-validated, citation-stripped `AdviceResponse`, which the client treats as **source of truth** and uses to replace everything rendered from deltas. Client disconnect is detected on the **response** `close` (not request close, which fires when the POST body is read) and aborts the expensive Call 2.

SSE wire protocol: `event: stage` (`intake`|`citations`|`writing`), `event: card`, `event: done`, `event: error`.

### Model notes
The two calls use **different models on purpose**: Sonnet for the cheap, fast intake reasoning; Haiku for the long readout generation (~2× faster token output, large `max_tokens: 16000`). If you change a model string, change it in `intakeProcessor.js` / `adviceGenerator.js` — they are pinned constants, not env-driven. Use the latest Claude model IDs (`claude-opus-4-8`, `claude-sonnet-4-6`, `claude-haiku-4-5`, `claude-fable-5`).

Generation is tolerant of imperfect model output: `coerceCard`/`coerceAdvice` fill missing fields with safe defaults and `parseAdviceText` falls back to a partial-JSON parse, so a dropped field degrades one card rather than 503-ing the whole readout. `assertSchema` is the final guard.

### Recovery Agent (`backend/src/recoveryAgent/`, V1 built)

A V1 agentic **fallback** layer that intercepts pipeline errors, classifies root cause, and picks one allowlisted recovery action (`retry_request` / `activate_fallback` / `fail_gracefully`; `log_diagnosis` is always-on in code) via Claude tool calling on Haiku, with a structured `[recoveryAgent]` audit log. It is **additive** — it does not replace the deterministic RAG core or touch the citation-allowlist guarantee. Full design + per-day implementation status: `docs/recovery-agent-design.md` (read it before working on the agent). Spec: `PRD_KTH_Error_Handling_Agent.md`. Acceptance harness: `npm run test:recovery` (drives the real controller with injected failures + deterministic agent decisions — no live model call; covers all five PRD scenarios).

`escalate(error, ctx)` returns a **directive** — `respond` (terminal envelope), `retry` (re-run the stage once), or `fallback` (continue in a degraded mode). **Both** controllers act on it at the **intake** and **readout** hooks — `adviceController.js` (buffered) and `adviceStreamController.js` (streaming, the frontend's path) — and the global middleware coerces non-terminal directives via `resolveToResponse`. On streaming, a readout `retry` is honored **only before the first card is emitted** (Option B partial output can't be re-sent without duplicating cards); after that the agent fails gracefully, preserving the original 429/503 SSE contract. Stream harness: `npm run test:recovery:stream`.

**Empty citation retrieval is NOT handled by the agent and never produces an all-F readout.** Both controllers apply a fixed policy: retry retrieval once, and if still empty, surface a `RETRIEVAL_UNAVAILABLE` (503) alert and stop. The streaming controller additionally emits an interim `notice` SSE event before the retry (shared copy in `src/utils/userMessages.js`). Showing a wholesale all-F "no evidence found" readout when retrieval failed was rejected — it misrepresents an outage as "no evidence about you" and undercuts the evidence-graded thesis. (Per-card F for an individual unsupported claim is unchanged.)

Invariants that must hold:
- **Both endpoints are agent-wired** at intake + readout (retrieval is deterministic on both). The streaming path is the one real users hit.
- **Escalate-for-demo**: the intake and Tavily stages currently degrade *silently* (they never throw); V1 deliberately re-routes those through the agent so it visibly chooses + audits the recovery. `activate_fallback` is restricted to degradation modes the pipeline already supports — no new content shaping.
- **Zero happy-path overhead**: the module is constructed/invoked only on throw; nothing in the success path imports it.
- **Recursion guard + 3s budget**: the agent's own Haiku classification call is *not* wrapped by the agent; its failure (or budget exhaustion) falls to a static pre-written envelope. The agent never handles its own errors.
- **Privacy** (extends the rules below): the agent context and audit log carry error class/stack, route, stage, sanitized payload *shape* (keys + types, never values), retry count, and provider metadata — never raw `healthCondition` text, demographics, or PII.

### Privacy / logging invariants (do not break these)
- Raw `healthCondition` text reaches **Call 1 only** — never sent to Tavily, never returned to the client, never logged. Only normalised research targets propagate downstream.
- Logs record **counts, status, timings, and an opaque `supportReference` only** — never field values, demographics, or condition text.
- Error responses to the client expose only `supportReference` (an opaque code). Stage names, request internals, and raw upstream errors stay in server logs. (This was a deliberate decision — leaking pipeline stage names was flagged as a security risk.)

## Frontend architecture

`App.tsx` is the single state owner. State machine: `landing → idle (form) → loading → results | error`. It calls `streamAdvice` (`src/api/adviceStream.ts`), wiring SSE callbacks (`onStage`/`onCard`/`onDone`/`onError`) into React state; `StreamingReadout` renders cards as they arrive, then `ResultsPanel` renders the final response.

Intake persists to **`sessionStorage`** (key `kth.intake`), never the URL — this preserves a retry/reload within the tab without leaking intake data and without surviving tab close (the "nothing is stored" promise).

Two-tier component layout under `src/components/`:
- `ui/` — presentational primitives (Button, Card, Chip, GradeTile, Input, etc.), no business logic, barrel-exported via `index.ts`.
- `features/` — domain composites (AdviceCard, InputForm, StreamingReadout, ResultsPanel, ErrorState, banners) that compose primitives. Dependency flows one way: features → ui, never the reverse.

`AdviceCard` owns its own three-tier expand/collapse state locally; cards are independent. The API contract types live in `src/types/api.ts`.

### Styling conventions
- Tailwind utilities over inline styles; use design-token names (e.g. `text-plum-500`) over hex/arbitrary values. Arbitrary values are fine for genuine one-offs but promote to a token if repeated 3+ times. Tokens are defined in `frontend/tailwind.config.js`.
- Use the `cn()` helper (`src/lib/cn.ts`) for conditional classes, not template-literal concatenation.
- **Voice rule:** "Thy" appears *only* in the brand name and logo lockup. All product copy uses modern English ("your", "you").
- Layout widths: `max-w-page` (640px), `max-w-form` (720px), `max-w-wide` (880px).
