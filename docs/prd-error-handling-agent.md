# PRD: KnowThyHealth Error-Handling Agent

**Status:** Draft v1 — June 10, 2026
**Owner:** Yael Lopez-Vivar
**Host application:** KnowThyHealth (React/Vite + Node/Express, deployed Vercel/Railway)
**Target:** V1 shipped and demonstrable before resume listing (build-then-list)

---

## Problem

KnowThyHealth depends on two external AI/data services (Anthropic, Tavily) and a multi-stage LLM pipeline (intake → retrieval → readout). Failures occur at runtime that the application does not handle gracefully: provider timeouts, rate limits, malformed JSON from the intake call, citation-validation rejections, and infrastructure-class errors (CORS, env misconfiguration). Today these surface as broken UX or silent degradation, and diagnosing them requires manual log reading.

Hardcoded error handling fails here for a structural reason: these errors are ambiguous at runtime. A Tavily empty-result is sometimes a transient failure (retry), sometimes a legitimate no-results state (degrade gracefully), sometimes a query-construction defect (fail with explanation). A fixed decision tree cannot classify intent from context; a model can. This is the canonical case for narrow runtime autonomy — letting the model choose the resolution path within a constrained action space.

## Goals

1. No unhandled error reaches the user as a raw failure. Every error is intercepted, diagnosed, and resolved or explained.
2. The agent autonomously selects and executes a recovery path from a constrained, allowlisted action set.
3. Every agent decision is fully auditable: structured log of error context, diagnosis, chosen action, and outcome.
4. The system demonstrates genuine agentic architecture (model-directed tool calling) as a portfolio credential, complementing KTH's deliberately deterministic RAG core.

## Non-Goals (V1)

- No code modification, data mutation, or deployment actions by the agent.
- No proactive/log-scanning mode (reactive interception only).
- No ops console UI (structured logs are the V1 interface; console is V2).
- No replacement of existing graceful handling — the agent is the fallback layer for errors NOT already handled programmatically.

## V1 Scope

**Interception.** Express error-handling middleware as the single choke point for unhandled backend errors, plus explicit try/catch escalation hooks at the three pipeline stages (intake call, citation fetch, readout call). Frontend errors are out of scope for V1.

**Diagnosis.** On interception, the agent receives: error object + stack trace, request context (route, sanitized payload shape, pipeline stage), and recent relevant state (e.g., retry count, provider response metadata). The agent classifies root cause: transient provider failure, rate limit, malformed model output, legitimate empty state, configuration defect, or unknown.

**Constrained autonomous recovery — the agentic core.** The agent chooses one path via tool calling:

| Tool | Action | Constraint |
|---|---|---|
| `retry_request` | Re-execute the failed call with backoff | Max 1 retry cycle per request; only for transient/rate-limit classes |
| `activate_fallback` | Continue the pipeline in degraded mode (e.g., readout without failed citation subset, cached demographic defaults) | Only predefined degradation modes; never fabricated content |
| `fail_gracefully` | Abort with a plain-language, stage-specific user explanation and suggested next step | Always available; the mandatory floor |
| `log_diagnosis` | Record classification + reasoning (called in all paths) | Always invoked |

**Hard safety rails:**
- Total agent latency budget: 3s; on budget exhaustion, automatic static fallback (pre-written user message) without agent involvement.
- The agent handling layer is itself wrapped: if the agent errors, static fallback fires. No recursion — the agent never handles its own errors.
- Fast/cheap model for classification (Haiku-class); the agent path must not meaningfully degrade p95 latency on the happy path (zero overhead when no error occurs).
- Action allowlist enforced in code, not in the prompt. The model selects among defined tools; it cannot invent actions.

**Audit trail.** Structured JSON log per incident: timestamp, error fingerprint, context summary, agent classification, reasoning excerpt, tool invoked, parameters, outcome, end-to-end handling latency. This is the demo artifact and the interview exhibit.

## V2 Roadmap (not in V1)

- Ops console: incident stream, diagnosis review, agent decision audit UI
- Config-defect detection (env var / CORS class) with remediation suggestions
- Provider failover as an action class
- Frontend error boundary integration
- Pattern detection across incidents (log-based retrospective mode)

## Architecture Sketch

```
Request → KTH pipeline stage → error thrown
  → existing programmatic handler? → handled (agent never invoked)
  → unhandled → Express error middleware → Agent Service
      → context assembly (error + request + stage state)
      → Anthropic messages call WITH tools parameter
      → model returns tool_use block (classification + chosen action)
      → code executes allowlisted action → outcome logged
      → [agent failure or timeout] → static fallback
```

New backend module: `errorAgent/` (context assembler, agent client with tool definitions, action executors, audit logger). No changes to the deterministic RAG core — the citation allowlist guarantee is untouched.

## Success Criteria (acceptance test = the resume bullet)

The project is resume-listable when every clause of this bullet is demonstrably true:

> *Designed and shipped an agentic error-handling layer for KnowThyHealth: an LLM agent using tool calling to intercept unhandled runtime errors, diagnose root cause from stack traces and request context, and autonomously execute constrained recovery actions (retry, fallback, graceful degradation) with a full audit trail of agent decisions.*

Concretely:
1. Kill Tavily mid-request (or force a timeout) → agent classifies transient, retries once, request succeeds → audit log shows the decision chain.
2. Force malformed JSON from the intake call → agent classifies model-output defect, fails gracefully with stage-specific user explanation.
3. Force a rate-limit response → agent retries with backoff or degrades, per classification.
4. Crash the agent itself → static fallback fires; user never sees a raw error.
5. Audit log is reviewable and tells the story without code access.

## Positioning Note (why this exists)

KTH's core is deliberately deterministic — orchestrated RAG with a post-hoc citation allowlist, chosen because verifiability outranks flexibility for health research. The error-handling layer is the complement: a domain where ambiguity outranks determinism, so model-directed autonomy earns its place. Together they form the portfolio argument: *both architectures shipped, with explicit reasoning about when each wins.* This directly addresses the "experience building agentic solutions" requirement (Sprout/Trellis, EDB-class roles) and the responsible-AI-deployment posture (Casepoint-class roles).

## Build Plan (Claude Code, est. 2–4 days)

1. **Day 1:** `errorAgent/` scaffolding — middleware choke point, context assembler, static fallback path, audit logger. Verify zero happy-path overhead.
2. **Day 1–2:** Agent client with tool definitions; classification prompt; `fail_gracefully` end-to-end (the floor works first).
3. **Day 2–3:** `retry_request` and `activate_fallback` executors with constraints; recursion guard; latency budget enforcement.
4. **Day 3–4:** Failure-injection test harness for the five acceptance scenarios; audit log review; README + this PRD into `/docs`.

## Open Questions

1. Degradation modes for `activate_fallback` — which are legitimate for KTH? (e.g., readout with partial citations: acceptable or violates the trust posture?)
2. Should `fail_gracefully` user messages be model-generated per incident (richer, riskier) or selected from pre-written templates by the agent (safer, V1 recommendation)?
3. Anthropic-only for the agent model, or abstract for provider flexibility? (V1 recommendation: Anthropic-only, abstraction is V2.)
