# Ship Report — KnowThyHealth Recovery Agent

**Status:** Shipped to production · June 2026 · [github.com/alexlv-product/knowthyhealth](https://github.com/alexlv-product/knowthyhealth)
**Surfaces:** frontend (Vercel) + backend (Railway), deployed from `main`.

A one-page account of what we built, the decisions behind it, and how it was verified. Full spec: [prd-recovery-agent.md](prd-recovery-agent.md). Engineering design: [recovery-agent-design.md](recovery-agent-design.md).

---

## The problem

KnowThyHealth depends on outside services — the Claude models and the Tavily research-source search — plus a multi-stage pipeline (intake → retrieval → readout). When those fail at runtime, two bad things happened: some failures surfaced as broken UX, and one failure mode was actively misleading — when the source search came back empty, the app composed a *complete-looking* readout where **every recommendation was graded F ("no evidence found"),** which tells the user *"there's no evidence for anything about you"* when the truth was *"we couldn't reach our sources."* For an evidence-graded product, that's the worst possible failure.

## What shipped

**1. An recovery agent.** When a pipeline step fails in an *ambiguous* way (garbled model output, a rate limit), a fixed rule can't tell whether to retry, continue degraded, or stop — but a model can. A fast, cheap LLM (Claude Haiku, tool-calling) reads the error context, **classifies the root cause,** and chooses exactly one **pre-approved recovery action** (retry · continue degraded · fail gracefully). Every decision is written to a structured **audit log** (error, diagnosis, action, outcome). Guardrails: a 3-second budget, no self-recursion, a code-enforced action allowlist (it can't invent actions), and **zero overhead on the happy path** — it only runs on a failure.

**2. Honest retrieval-failure UX.** Empty source retrieval no longer produces an all-F readout. We retry once, and if it still fails we surface a clear alert and stop. On the live (streaming) path the user sees an interim "we're retrying" note, then either the real readout or — if it's still down — *"the service that retrieves the sources isn't responding; we won't show you incomplete results."* If they retry and it keeps failing, the message escalates to *"this is out of our hands, please wait 10 minutes,"* and the retry button becomes a re-enabling 10-minute countdown.

## Key product decisions

| Decision | Why |
|---|---|
| **Show nothing rather than something misleading** | Protects the core evidence-graded promise. A hollow all-F readout is worse than an honest "try again." |
| **Don't expose the technical "why" to users** | Naming the vendor or showing "key expired" leaks architecture and can alarm users; the diagnostic detail stays in logs behind an opaque support reference. The *user-meaningful* why (transient outage vs. genuinely no results) is the V2 upgrade. |
| **Use the agent only where judgment matters** | Retrieval failure follows a fixed policy (retry → alert), so it's deterministic, not agent-driven — the agent owns the genuinely ambiguous failures (intake, readout). |
| **Guide, don't lock out** | The countdown re-enables; users are never hard-blocked if the service recovers early. |

## Why an agent here (architecture rationale)

KnowThyHealth's core is deliberately **deterministic** — orchestrated retrieval with verified citations and zero model-invented sources, because verifiability outranks flexibility for health information. Error handling is the opposite kind of problem: genuinely ambiguous, where a fixed decision tree can't classify intent from context. Shipping both — a deterministic core *and* a constrained, audited agent — with explicit reasoning about when each wins is the point.

## Verification

- **Acceptance harness** — 5 failure scenarios (transient retry, malformed output, rate limit, agent-crash fallback, audit completeness) + audit-schema checks: all pass.
- **Live, end-to-end on production** — a normal request returns a real, evidence-graded readout (5 cards, grades A–B) with the agent dormant; injected failures classify and recover in ~1.7–2.5s, under the 3-second budget; no raw errors leak; the audit log carries payload *shape* only, never field values.

## Scope & what's next

**Scope:** the agent runs on **both** the buffered API and the live **streaming** path (the one the browser uses), at the intake and readout stages; retrieval failures are handled deterministically on both. On streaming, a readout retry is honored only before the first card streams (partial output can't be safely re-sent). Remaining boundary: we can't yet distinguish "service down" from "genuinely no results" — both show the same retrieval alert.

**V2 roadmap:** surface the retrieval *cause* and split the message (transient → "try again"; genuinely empty → "no research matched your profile"); an ops console for the decision audit trail; provider failover.
