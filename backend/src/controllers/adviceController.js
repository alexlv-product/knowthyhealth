/**
 * adviceController.js — SAD §3.2.2. The single request orchestrator.
 *
 * Updated for PRD v1.4. Decision flow:
 *
 *   validate (gender + age required; everything else optional)
 *     → Call 1 (intake): ALWAYS fires — identifies research targets + condition
 *        context. [fail → degrade: intakeContext = null]
 *     → Tavily: fetch citations seeded by research targets + demographic
 *        [fail → tavilyFailed]
 *     → Call 2 (readout): domain-grouped, graded cards [429 → 429, else → 503]
 *     → validate citations (strip + downgrade)            [never throws]
 *     → 200 with the cleaned response
 *
 * Error → HTTP mapping (API Design §2.6):
 *   ValidationError       → 400 VALIDATION_ERROR
 *   RateLimitError        → 429 RATE_LIMIT_ERROR
 *   AdviceGenerationError → 503 ADVICE_GENERATION_ERROR
 *   anything else         → next(err) → global handler → 500 INTERNAL_ERROR
 *
 * Every error response carries an opaque supportReference (PRD v1.4 §5.2) — the
 * only diagnostic detail exposed to the client. The same code is logged next to
 * the (log-only) counts and status; stage/timestamp/raw upstream errors never
 * reach the client.
 *
 * Logging hygiene (Flag #10): only counts, status, and the support reference —
 * never field values, demographics, or health-condition text.
 */

const { validateInput } = require('../utils/inputValidator');
const { processIntake } = require('../services/intakeProcessor');
const { fetchCitations } = require('../services/citationFetcher');
const { generateAdvice } = require('../services/adviceGenerator');
const { validateCitations } = require('../services/citationValidator');
const {
  ValidationError,
  RateLimitError,
  AdviceGenerationError,
  newSupportReference,
} = require('../utils/errors');

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

  // ── Step 1: validate (throws ValidationError → 400) ───────────────────────
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

  // ── Step 2: Claude Call 1 — intake (ALWAYS fires; fail → degrade) ─────────
  const tIntake = Date.now();
  let intakeContext = null;
  let degradedConditionContext = false;
  try {
    intakeContext = await processIntake(body);
    log.claudeCalls += 1;
  } catch {
    // Includes RateLimitError from Call 1 — a Call 1 failure degrades, never
    // fails the request. If a condition was disclosed, flag the readout degraded.
    intakeContext = null;
    degradedConditionContext = body.healthCondition !== null;
    log.claudeCalls += 1;
  }
  log.msIntake = Date.now() - tIntake;

  // ── Step 3: Tavily citations (fail → tavilyFailed, never throw) ───────────
  const citationProfile = {
    gender: body.gender,
    ageRange: body.ageRange,
    symptoms: body.symptoms,
    researchTargets: intakeContext ? intakeContext.researchTargets : [],
    conditionCategory: intakeContext ? intakeContext.conditionCategory : null,
  };
  const tTavily = Date.now();
  const { citations, queryCount } = await fetchCitations(citationProfile);
  log.msTavily = Date.now() - tTavily;
  const tavilyFailed = citations.length === 0;
  log.tavilyQueries = queryCount;

  // ── Step 4: Claude Call 2 — readout (429 → 429, else → 503) ───────────────
  const tAdvice = Date.now();
  let advice;
  try {
    advice = await generateAdvice(
      body,
      citations,
      intakeContext,
      tavilyFailed,
      degradedConditionContext
    );
    log.claudeCalls += 1;
  } catch (err) {
    log.claudeCalls += 1;
    log.msAdvice = Date.now() - tAdvice;
    if (err instanceof RateLimitError) {
      log.status = 429;
      console.info('[advice]', JSON.stringify(log));
      if (err.retryAfterSeconds) res.set('Retry-After', String(err.retryAfterSeconds));
      return res.status(429).json({
        error: 'RATE_LIMIT_ERROR',
        message: "We're experiencing high demand right now. Please wait a moment and try again.",
        supportReference,
      });
    }
    if (err instanceof AdviceGenerationError) {
      log.status = 503;
      console.info('[advice]', JSON.stringify(log));
      return res.status(503).json({
        error: 'ADVICE_GENERATION_ERROR',
        message: "We weren't able to generate your readout right now. Please try again in a moment.",
        supportReference,
      });
    }
    return next(err);
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
