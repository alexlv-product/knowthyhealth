# Recovery Agent — Design Note (V1)

Companion to `PRD_KTH_Error_Handling_Agent.md`. This note resolves the three places
where the PRD's mental model didn't match the actual codebase, and records the
decisions that scaffolding should encode. Source of truth for the build; update it
if a decision changes.

> **Update (post-V1, retrieval policy):** Empty citation retrieval is **no longer an
> agent decision** and never produces an all-F readout. Both controllers now apply a
> fixed policy — retry retrieval once, then a terminal `RETRIEVAL_UNAVAILABLE` (503)
> alert; the streaming controller emits an interim `notice` event before the retry.
> Rationale: a wholesale all-F readout misrepresents a retrieval outage as "no evidence
> about you," undercutting the evidence-graded thesis; and we observed the agent
> mis-classifies the empty case anyway (it can't see the provider error). The agent now
> owns **intake** and **readout** failures only. Consequently `activate_fallback` is
> valid only at the intake stage (mode `proceed_without_intake_context`); the
> `proceed_tavily_failed` mode and the citations escalation hook were removed. The
> citations-related rows below are superseded by this note.

## Decisions locked (2026-06-10)

| Decision | Choice | Why |
|---|---|---|
| Interception target | **Buffered first, then streaming** | V1 started on buffered `/api/v1/advice` (clean single choke point). The follow-up wired the same hooks into `/advice/stream` (the frontend's path): directives map to SSE events, and mid-stream `retry_request` is constrained to *before the first card streams*. Both endpoints are now agent-wired. |
| Escalation model | **Escalate-for-demo** | The pipeline already degrades silently at intake and Tavily (they never throw). For the agent to *visibly choose* among recovery paths — and to exercise all five acceptance scenarios — those auto-degradations are deliberately re-routed through the agent. Revisit if this becomes more than a demo (a productionized version may want some degradations to stay silent/fast). |
| `fail_gracefully` copy | **Agent-selected templates** | The error path is the worst place for unvetted model text; templates are deterministic, zero extra latency, and stay inside the 3s budget. Model-generated copy is V2. |
| Agent model | **Anthropic-only, Haiku-class** | Fast/cheap classification; provider abstraction is V2. |

## How errors actually reach the agent

The current pipeline (`adviceController.js`) is already robustly graceful, which is
why "escalate-for-demo" is required — without it the agent rarely fires:

- **Stage 1 — intake** (`processIntake`): a failure is caught and degraded to
  `intakeContext = null` **silently** (never throws).
- **Stage 2 — Tavily** (`fetchCitations`): **never throws**; on failure returns `[]`
  and the controller sets `tavilyFailed = true`.
- **Stage 3 — readout** (`generateAdvice`): the only stage that throws —
  `RateLimitError` → 429, `AdviceGenerationError` → 503.
- **Global handler** (`server.js`): catches anything else → 500 `INTERNAL_ERROR`.

### Escalation hooks (what changes)

At each of the three stage `try/catch` sites, instead of handling inline, call
`recoveryAgent.escalate(error, ctx)` and let the agent pick an allowlisted action:

| Hook | Today (inline) | After escalation — agent may choose |
|---|---|---|
| **Stage 1 intake** | silent `intakeContext = null` | `retry_request` (1 cycle) · `activate_fallback` = proceed with `intakeContext = null` (→ Tavily demographic-spine fallback, the *existing* behavior, now audited) · `fail_gracefully` |
| **Stage 2 Tavily** | silent `tavilyFailed = true` | `retry_request` (re-fetch) · `activate_fallback` = proceed with `tavilyFailed = true` (Mode 1: all-F readout) · `fail_gracefully` (when classified as query-construction defect) |
| **Stage 3 readout** | 429 / 503 envelope | `retry_request` (1 cycle) · `fail_gracefully`. **`activate_fallback` is NOT meaningful here** — a failed readout leaves no content to degrade *to*. |
| **Global middleware** | 500 envelope | classify → `fail_gracefully` (static). No stage context, so it's the floor only. |

## Action allowlist (enforced in code, not the prompt)

The model returns a `tool_use` selecting one tool; the executor validates the name
against a `const` allowlist before running. An unknown/invented action → `fail_gracefully`.

- **`retry_request`** — re-invoke the failed stage function **once**, with backoff.
  Guarded by `retryCount` carried in the context (max 1 cycle per request). Only for
  transient / rate-limit classifications.
- **`activate_fallback`** — restricted to **degradation modes the pipeline already
  supports**: `{ proceed_without_intake_context, proceed_tavily_failed }`. **No new
  content shaping.** Note: partial-but-verified citations are *already* the standing
  contract — `validateCard` keeps each card's valid citation subset and only drops a
  card to F when stripping empties it. There is no all-or-nothing citation rule to
  relax, so `activate_fallback` introduces zero new trust surface.
- **`fail_gracefully`** — select a stage-specific template (`templates.js`), map to the
  existing error envelope (`VALIDATION_ERROR` / `RATE_LIMIT_ERROR` /
  `ADVICE_GENERATION_ERROR` / `INTERNAL_ERROR`) + `supportReference`. **Always available
  — the mandatory floor.**
- **`log_diagnosis`** — always invoked (every path) to write the audit record.

## Safety rails (concrete)

- **3s total agent budget.** On exhaustion → static fallback (existing envelope), no
  agent involvement. Wall-clock timer started in `escalate()`.
- **Recursion guard.** The agent's *own* Anthropic (Haiku) classification call is **not**
  wrapped by the agent. A 429/failure from that call → static fallback. The recoveryAgent
  never handles recoveryAgent errors. No path re-enters `escalate()`.
- **Zero happy-path overhead.** The module is constructed/invoked **only on throw**.
  Nothing in the success path imports or runs it. (Acceptance: p95 on a clean request
  unchanged.)
- **Privacy (extends Flag #10 / SAD §7.2).** The context assembler and audit log carry
  **error class, stack, route, pipeline stage, sanitized payload *shape* (keys + types,
  never values), retry count, and provider response metadata (status, `retry-after`)**
  — never raw `healthCondition` text, demographic values, or any PII. This invariant is
  non-negotiable and mirrors the existing logging hygiene.

## Audit record schema

One structured JSON line per incident, logged under a new `[recoveryAgent]` tag (same
style as the existing `[advice]` log), reusing the request's `supportReference` as the
correlation id:

```
{ ts, ref, stage, errorFingerprint, contextSummary, classification,
  reasoningExcerpt, toolInvoked, toolParams, outcome, handlingLatencyMs }
```

This is the demo artifact and the interview exhibit — it must tell the decision story
without code access.

## Module layout

```
backend/src/recoveryAgent/
  index.js            escalate(error, ctx) entry + wrapped global middleware;
                      budget timer, recursion guard, static-fallback floor
  contextAssembler.js builds the privacy-safe context (shape, not values)
  agentClient.js      Anthropic messages.create WITH tools; tool defs + classification
                      system prompt; Haiku model, maxRetries: 0
  actions.js          executors + the const action allowlist
  templates.js        stage-specific fail_gracefully copy
  auditLogger.js      structured [recoveryAgent] incident record
```

No changes to the deterministic RAG core (`citationFetcher`, `citationValidator`,
`adviceGenerator` generation logic) — the citation-allowlist guarantee is untouched.

## Acceptance-scenario → hook mapping

1. **Kill Tavily / force timeout** → Stage 2 hook → classify *transient* →
   `retry_request` → succeeds → audit shows the chain.
2. **Malformed intake JSON** → Stage 1 hook → classify *model-output defect* →
   `fail_gracefully` with the intake-stage template.
3. **Rate-limit response** → Stage 3 (or 1) hook → classify *rate limit* →
   `retry_request` with backoff, else `activate_fallback`.
4. **Crash the agent itself** → recursion guard / budget → static fallback fires; user
   never sees a raw error.
5. **Audit log reviewable** → `auditLogger` output reads as a decision narrative.

## Implementation status

- **Day 1 (done):** `recoveryAgent/` scaffold — `contextAssembler`, `auditLogger`, `templates`, `index` (global middleware choke point + static floor). Wired into `server.js` (replaced the bare 500 handler). Zero happy-path overhead verified.
- **Day 2 (done):** `agentClient` — Haiku (`claude-haiku-4-5`) non-streaming tool call, `tool_choice: {type:'any', disable_parallel_tool_use:true}` (model picks exactly one of the three action tools; allowlist enforced in code via `actions.ALLOWLIST`). `actions.dispatch` + `failGracefully` implemented end-to-end. `escalate()` runs the classifier under the 3s budget with a `withBudget` race; recursion guard holds (the agent's own model call is never re-escalated); any agent/budget/disallowed-action failure falls to the static floor, preserving the model's classification in the audit. `AGENT_ENABLED = true`. Verified live: classifications land in ~1.7–1.8s, well under budget.
- **Day 3 (done):** `escalate()` now returns a **directive** (`respond` | `retry` | `fallback`); the executors validate per-stage constraints in code (`retryRequest` honors the one-retry budget; `activateFallback` is valid only at intake/citations and only for the existing modes — readout `activate_fallback` rejects → static floor). Stage escalation hooks added to `adviceController.js` (the buffered endpoint) at intake / citations (escalates on empty retrieval) / readout; the controller carries out retry/fallback and sends terminal `respond` directives. The global middleware coerces non-terminal directives via `resolveToResponse`. Failure-injection harness `test/recoveryAgentScenarios.js` (`npm run test:recovery`) drives the real controller with injected failures + deterministic agent decisions and asserts all **five acceptance scenarios + the audit-record schema** — all pass.
- **Agent on the streaming path (done — formerly V2):** the agent is now wired into `adviceStreamController.js`, the **user-facing** endpoint, at the **intake** and **readout** stages (retrieval stays deterministic on both paths). Directives map to SSE: `retry`/`fallback` continue the stream; `respond` emits a terminal `error` event. The hard case — a readout failure *mid-stream* — is handled by honoring `retry` **only before the first card is emitted** (Option B partial output can't be safely re-sent without duplicating cards); once cards are on the wire the agent can only fail gracefully, preserving the original 429/503 contract. Harness `test/recoveryAgentStreamScenarios.js` (`npm run test:recovery:stream`) covers six stream scenarios incl. that guard; verified live (happy path streams 4 cards, agent dormant). **The agent now runs on the path real users hit.**

> Note: backend deps must be installed (`npm install` in `backend/`) — `@anthropic-ai/sdk` was absent from this checkout.

## Deferred to V2

**Surface the retrieval *cause* and split the copy (high priority).** Today `citationFetcher`
swallows the underlying error and returns `[]`, so neither the pipeline nor the agent can
tell *why* retrieval came back empty — a transient provider outage, a config defect (bad/
expired key, CORS), rate-limiting, or a genuine no-results state are indistinguishable.
V1 treats them all as one `RETRIEVAL_UNAVAILABLE` "temporarily unavailable, try again"
alert. V2: have `citationFetcher` capture the status/error class into `providerMeta`, then
branch the *user-facing* copy by category — transient → "try again"; genuine empty →
"we couldn't find research matching your profile" (retrying won't help; broaden inputs).
Keep the *diagnostic* why (vendor, status code, key state) out of the UI — it stays in the
logs / agent audit behind the `supportReference`; exposing it leaks architecture and can
alarm users. This is the "categorical why" a user can act on, done safely.



Model-generated `fail_gracefully` copy · provider abstraction · frontend error-boundary
integration · ops-console UI · cross-incident pattern detection · config-defect (env/CORS)
detection. (Streaming interception is now done — see Implementation status. `demographic-default
cached targets` from PRD Open Q1 is unnecessary — intake-null already falls through to the
Tavily demographic spine.)
