/**
 * adviceController.js — SAD §3.2.2. The single request orchestrator (buffered).
 *
 * PRD v1.4 pipeline, now with the recovery AGENT wired in at each stage
 * (PRD: KTH Recovery Agent). The pipeline already degraded gracefully on its
 * own; the agent makes those decisions model-directed and audited ("escalate-for-
 * demo"). At each of the three stages, on failure the controller calls
 * recoveryAgent.escalate() and acts on the returned directive:
 *
 *   'respond'  → terminal: send the agent's (or static-floor) envelope and stop.
 *   'retry'    → re-run this stage once, then continue (bounded to one retry cycle).
 *   'fallback' → continue in the stage's degraded mode (the pre-existing behavior).
 *
 * Decision flow:
 *   validate (gender + age required) — ValidationError → 400 (no agent; pre-pipeline)
 *     → Call 1 (intake): escalate on failure → retry | fallback(null ctx) | respond
 *     → Tavily: EMPTY retrieval is deterministic (NOT the agent) — retry once, then
 *       RETRIEVAL_UNAVAILABLE; never an all-F readout
 *     → Call 2 (readout): escalate on failure → retry | respond
 *           (activate_fallback is invalid here — nothing to degrade to — so the
 *            executor rejects it and the agent falls to the static 429/503 floor)
 *     → validate citations (never throws)
 *     → 200 with the cleaned response
 *
 * The streaming endpoint (/api/v1/advice/stream — the frontend's path) is
 * deliberately NOT wired to the agent in V1 (design note: buffered only).
 *
 * Logging hygiene (Flag #10): the [advice] log carries only counts, status, timings,
 * and the support reference. The agent's own [recoveryAgent] incident log reuses that
 * same support reference so the two correlate.
 */

const { validateInput } = require('../utils/inputValidator');
const { processIntake } = require('../services/intakeProcessor');
const { fetchCitations } = require('../services/citationFetcher');
const { generateAdvice } = require('../services/adviceGenerator');
const { validateCitations } = require('../services/citationValidator');
const { escalate } = require('../recoveryAgent');
const { STATUS_FOR_CODE } = require('../recoveryAgent/templates');
const { RETRIEVAL_UNAVAILABLE, RETRIEVAL_TERMINAL_MESSAGE } = require('../utils/userMessages');
const { ValidationError, RateLimitError, newSupportReference } = require('../utils/errors');

module.exports = async function adviceController(req, res, next) {
  const startedAt = Date.now();
  const supportReference = newSupportReference();
  const log = {
    ts: new Date().toISOString(),
    ref: supportReference,
    conditionDisclosed: false,
    claudeCalls: 0,
    tavilyQueries: 0,
    strippedCitations: 0,
    status: 0,
  };

  /** Send a terminal directive (fail_gracefully / static floor) and finish the log. */
  const sendDirective = (directive) => {
    if (directive.headers) {
      for (const [k, v] of Object.entries(directive.headers)) res.set(k, v);
    }
    log.status = directive.status;
    log.ms = Date.now() - startedAt;
    console.info('[advice]', JSON.stringify(log));
    return res.status(directive.status).json(directive.body);
  };

  // ── Step 1: validate (throws ValidationError → 400) ───────────────────────
  // Pre-pipeline input validation is not an agent concern — a bad request is a
  // clean 400, not a runtime failure to diagnose.
  let body;
  try {
    body = validateInput(req.body);
  } catch (err) {
    if (err instanceof ValidationError) {
      log.status = 400;
      console.info('[advice]', JSON.stringify(log));
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: err.message,
        supportReference,
      });
    }
    return next(err);
  }

  log.conditionDisclosed = body.healthCondition !== null;

  // ── Step 2: Claude Call 1 — intake, escalated on failure ──────────────────
  let intakeContext = null;
  let degradedConditionContext = false;
  try {
    intakeContext = await processIntake(body);
    log.claudeCalls += 1;
  } catch (err) {
    log.claudeCalls += 1;
    const directive = await escalate(err, { req, stage: 'intake', retryCount: 0, supportReference });
    if (directive.kind === 'retry') {
      try {
        intakeContext = await processIntake(body);
        log.claudeCalls += 1;
      } catch {
        log.claudeCalls += 1; // retry spent — degrade (the existing safe behavior)
        intakeContext = null;
        degradedConditionContext = body.healthCondition !== null;
      }
    } else if (directive.kind === 'fallback') {
      // proceed_without_intake_context → continue on the demographic spine.
      intakeContext = null;
      degradedConditionContext = body.healthCondition !== null;
    } else {
      return sendDirective(directive); // fail_gracefully / static floor
    }
  }

  // ── Step 3: Tavily citations — deterministic retry-then-alert on EMPTY ─────
  // Empty retrieval is NOT degraded to an all-F readout (that would misrepresent a
  // retrieval outage as "no evidence about you"). The agent is NOT consulted here —
  // the policy is fixed: retry once, and if still empty, surface a clear alert and
  // stop. We never compose a readout from zero citations.
  const citationProfile = {
    gender: body.gender,
    ageRange: body.ageRange,
    symptoms: body.symptoms,
    researchTargets: intakeContext ? intakeContext.researchTargets : [],
    conditionCategory: intakeContext ? intakeContext.conditionCategory : null,
  };
  const tTavily = Date.now();
  let { citations, queryCount } = await fetchCitations(citationProfile);
  log.tavilyQueries = queryCount;

  if (citations.length === 0) {
    const retried = await fetchCitations(citationProfile); // the one retry
    citations = retried.citations;
    log.tavilyQueries += retried.queryCount;
    if (citations.length === 0) {
      log.msTavily = Date.now() - tTavily;
      return sendDirective({
        kind: 'respond',
        status: STATUS_FOR_CODE[RETRIEVAL_UNAVAILABLE],
        headers: {},
        body: { error: RETRIEVAL_UNAVAILABLE, message: RETRIEVAL_TERMINAL_MESSAGE, supportReference },
      });
    }
  }
  log.msTavily = Date.now() - tTavily;

  // ── Step 4: Claude Call 2 — readout, escalated on failure ─────────────────
  const tAdvice = Date.now();
  let advice;
  try {
    advice = await generateAdvice(body, citations, intakeContext, false, degradedConditionContext);
    log.claudeCalls += 1;
  } catch (err) {
    log.claudeCalls += 1;
    const directive = await escalate(err, { req, stage: 'readout', retryCount: 0, supportReference });
    if (directive.kind === 'retry') {
      try {
        advice = await generateAdvice(body, citations, intakeContext, false, degradedConditionContext);
        log.claudeCalls += 1;
      } catch (err2) {
        // Retry spent — a readout failure has no degraded fallback, so this is
        // terminal. Preserve the original 429/503 contract.
        log.claudeCalls += 1;
        log.msAdvice = Date.now() - tAdvice;
        return sendReadoutFailure(res, log, startedAt, err2, supportReference);
      }
    } else {
      // 'respond' (fail_gracefully / static floor). 'fallback' can't occur — the
      // executor rejects activate_fallback at the readout stage.
      log.msAdvice = Date.now() - tAdvice;
      return sendDirective(directive);
    }
  }
  log.msAdvice = Date.now() - tAdvice;

  // ── Step 5: citation validation (never throws) ────────────────────────────
  const { response, strippedCount } = validateCitations(advice, citations);
  log.strippedCitations = strippedCount;

  // ── Step 6: respond ───────────────────────────────────────────────────────
  log.status = 200;
  log.ms = Date.now() - startedAt;
  console.info('[advice]', JSON.stringify(log));
  return res.status(200).json(response);
};

/** Terminal envelope for a readout failure that exhausted its one retry. */
function sendReadoutFailure(res, log, startedAt, err, supportReference) {
  if (err instanceof RateLimitError) {
    log.status = 429;
    log.ms = Date.now() - startedAt;
    console.info('[advice]', JSON.stringify(log));
    if (err.retryAfterSeconds) res.set('Retry-After', String(err.retryAfterSeconds));
    return res.status(429).json({
      error: 'RATE_LIMIT_ERROR',
      message: "We're experiencing high demand right now. Please wait a moment and try again.",
      supportReference,
    });
  }
  log.status = 503;
  log.ms = Date.now() - startedAt;
  console.info('[advice]', JSON.stringify(log));
  return res.status(503).json({
    error: 'ADVICE_GENERATION_ERROR',
    message: "We weren't able to generate your readout right now. Please try again in a moment.",
    supportReference,
  });
}
