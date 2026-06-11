/**
 * adviceStreamController.js — SSE variant of adviceController (SAD §3.2.2).
 *
 * Identical pipeline and error→envelope mapping as the non-streaming controller,
 * but Call 2 (the readout) is streamed token-by-token so the UI can render the
 * domain cards progressively instead of waiting ~2 minutes for the whole JSON.
 *
 * Wire protocol (Server-Sent Events). Input is validated BEFORE switching to SSE
 * so a bad request still returns a normal 400 JSON envelope. Once streaming:
 *   event: stage   data: {"stage":"intake"|"citations"|"writing"}
 *   event: notice  data: {"message":"<interim user-facing note, e.g. retrying retrieval>"}
 *   event: card    data: {"card": <validated AdviceCard>, "index": n}   (Call 2, per card)
 *   event: done    data: {"response": <validated AdviceResponse>}
 *   event: error   data: {"error","message","supportReference",[retryAfterSeconds]}
 *
 * The `done` payload is the SAME schema-validated, citation-stripped object the
 * non-streaming endpoint returns — the client treats it as the source of truth
 * and replaces whatever it rendered from the raw deltas.
 *
 * Logging hygiene (Flag #10): counts, status, support reference, and timings only.
 */

const { validateInput } = require('../utils/inputValidator');
const { processIntake } = require('../services/intakeProcessor');
const { fetchCitations } = require('../services/citationFetcher');
const { generateAdviceStream } = require('../services/adviceGenerator');
const { validateCitations, validateCard, buildValidSet } = require('../services/citationValidator');
const {
  ValidationError,
  RateLimitError,
  AdviceGenerationError,
  newSupportReference,
} = require('../utils/errors');
const {
  RETRIEVAL_UNAVAILABLE,
  RETRIEVAL_INTERIM_MESSAGE,
  RETRIEVAL_TERMINAL_MESSAGE,
} = require('../utils/userMessages');

module.exports = async function adviceStreamController(req, res, next) {
  const startedAt = Date.now();
  const supportReference = newSupportReference();
  const log = {
    ts: new Date().toISOString(),
    ref: supportReference,
    mode: 'stream',
    conditionDisclosed: false,
    claudeCalls: 0,
    tavilyQueries: 0,
    strippedCitations: 0,
    status: 0,
  };

  // ── Step 1: validate BEFORE SSE, so a bad request returns a normal 400 ────
  let body;
  try {
    body = validateInput(req.body);
  } catch (err) {
    if (err instanceof ValidationError) {
      log.status = 400;
      console.info('[advice:stream]', JSON.stringify(log));
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: err.message,
        supportReference,
      });
    }
    return next(err);
  }
  log.conditionDisclosed = body.healthCondition !== null;

  // ── Switch to SSE ─────────────────────────────────────────────────────────
  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // disable proxy buffering (nginx/Railway)
  });
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  let clientGone = false;
  const abortController = new AbortController();
  // Detect a real client disconnect on the RESPONSE, not the request: req 'close'
  // fires as soon as the POST body is fully read (well before Call 2), which would
  // pre-abort generation. res 'close' fires only when the connection actually ends.
  res.on('close', () => {
    if (res.writableEnded) return; // normal completion — nothing to abort
    clientGone = true;
    // Stop the (expensive, ~2 min) Claude generation if the user navigated away.
    abortController.abort();
  });
  const send = (event, data) => {
    if (clientGone || res.writableEnded) return;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // ── Step 2: Claude Call 1 — intake (always fires; fail → degrade) ──────────
  send('stage', { stage: 'intake' });
  const tIntake = Date.now();
  let intakeContext = null;
  let degradedConditionContext = false;
  try {
    intakeContext = await processIntake(body);
    log.claudeCalls += 1;
  } catch {
    intakeContext = null;
    degradedConditionContext = body.healthCondition !== null;
    log.claudeCalls += 1;
  }
  log.msIntake = Date.now() - tIntake;

  // ── Step 3: Tavily citations — deterministic retry-then-alert on EMPTY ─────
  // Empty retrieval is NOT degraded to an all-F readout. Tell the user we're retrying
  // (an interim `notice` event), retry once, and if still empty surface a clear
  // `error` and stop — we never stream a readout composed from zero citations.
  send('stage', { stage: 'citations' });
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
    send('notice', { message: RETRIEVAL_INTERIM_MESSAGE });
    const retried = await fetchCitations(citationProfile); // the one retry
    citations = retried.citations;
    log.tavilyQueries += retried.queryCount;
    if (citations.length === 0) {
      log.msTavily = Date.now() - tTavily;
      log.status = 503; // RETRIEVAL_UNAVAILABLE
      console.info('[advice:stream]', JSON.stringify(log));
      send('error', {
        error: RETRIEVAL_UNAVAILABLE,
        message: RETRIEVAL_TERMINAL_MESSAGE,
        supportReference,
      });
      return res.end();
    }
  }
  log.msTavily = Date.now() - tTavily;

  // ── Step 4: Claude Call 2 — readout, STREAMED card-by-card ────────────────
  // Each card is citation-validated the instant it finishes generating, then
  // streamed down already verified — so the UI never shows an unvalidated source.
  send('stage', { stage: 'writing' });
  const validSet = buildValidSet(citations);
  const tAdvice = Date.now();
  let advice;
  try {
    advice = await generateAdviceStream(
      body,
      citations,
      intakeContext,
      false, // tavilyFailed is never true here — empty retrieval errored out above
      degradedConditionContext,
      (card, index) => {
        const { card: verified } = validateCard(card, validSet);
        send('card', { card: verified, index });
      },
      abortController.signal
    );
    log.claudeCalls += 1;
  } catch (err) {
    log.claudeCalls += 1;
    log.msAdvice = Date.now() - tAdvice;
    if (err instanceof RateLimitError) {
      log.status = 429;
      console.info('[advice:stream]', JSON.stringify(log));
      send('error', {
        error: 'RATE_LIMIT_ERROR',
        message: "We're experiencing high demand right now. Please wait a moment and try again.",
        supportReference,
        retryAfterSeconds: err.retryAfterSeconds || null,
      });
      return res.end();
    }
    if (err instanceof AdviceGenerationError) {
      log.status = 503;
      console.info('[advice:stream]', JSON.stringify(log));
      send('error', {
        error: 'ADVICE_GENERATION_ERROR',
        message: "We weren't able to generate your readout right now. Please try again in a moment.",
        supportReference,
      });
      return res.end();
    }
    log.status = 500;
    console.error('[advice:stream unhandled]', JSON.stringify({ ref: supportReference }), err && err.message ? err.message : err);
    send('error', {
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again.',
      supportReference,
    });
    return res.end();
  }
  log.msAdvice = Date.now() - tAdvice;

  // ── Step 5: citation validation (never throws) ────────────────────────────
  const { response, strippedCount } = validateCitations(advice, citations);
  log.strippedCitations = strippedCount;

  // ── Step 6: final validated payload ───────────────────────────────────────
  log.status = 200;
  log.ms = Date.now() - startedAt;
  console.info('[advice:stream]', JSON.stringify(log));
  send('done', { response });
  return res.end();
};
