/**
 * templates.js — static fallback copy + error→envelope mapping (Day 1 floor).
 *
 * This is the mandatory floor of the error agent: pre-written, deterministic
 * user-facing messages that fire WITHOUT any model involvement. The agent's
 * `fail_gracefully` action (Day 2) selects from these by stage; the recursion
 * guard / budget exhaustion path falls back to them directly.
 *
 * Wire parity: the messages and error codes here are exactly what the existing
 * controllers return today (adviceController.js / server.js), so routing an
 * error through the agent produces an identical response envelope — just
 * classified and audited.
 */

const { RETRIEVAL_UNAVAILABLE, RETRIEVAL_TERMINAL_MESSAGE } = require('../utils/userMessages');

/** Canonical user-facing copy per error code. Keep in sync with the controllers. */
const ENVELOPE_COPY = {
  VALIDATION_ERROR: 'Your request could not be processed. Please check your form and try again.',
  RATE_LIMIT_ERROR: "We're experiencing high demand right now. Please wait a moment and try again.",
  ADVICE_GENERATION_ERROR:
    "We weren't able to generate your readout right now. Please try again in a moment.",
  INTERNAL_ERROR: 'An unexpected error occurred. Please try again.',
};

/**
 * Stage-specific `fail_gracefully` templates (Day 2 agent selects among these).
 * Each maps to a wire envelope code + a short, plain-language explanation with a
 * suggested next step. Seeded now so the floor has stage-aware copy available.
 */
const STAGE_TEMPLATES = {
  intake: {
    code: 'INTERNAL_ERROR',
    message:
      "We couldn't process your intake just now. Please try again in a moment — your details are still here.",
  },
  citations: {
    // Retrieval is handled deterministically in the controllers (retry once → alert),
    // not by the agent; this template exists only for completeness.
    code: RETRIEVAL_UNAVAILABLE,
    message: RETRIEVAL_TERMINAL_MESSAGE,
  },
  readout: {
    code: 'ADVICE_GENERATION_ERROR',
    message: ENVELOPE_COPY.ADVICE_GENERATION_ERROR,
  },
  unknown: {
    code: 'INTERNAL_ERROR',
    message: ENVELOPE_COPY.INTERNAL_ERROR,
  },
};

/**
 * Map a thrown error to its wire envelope. Mirrors the controller's instanceof
 * switch, so an error reaching the agent is shaped identically to one the
 * controller handled inline. Falls back to INTERNAL_ERROR / 500.
 *
 * @param {Error} error
 * @returns {{ status: number, code: string, message: string, retryAfterSeconds: (number|null) }}
 */
function mapErrorToEnvelope(error) {
  const name = error && error.name;
  if (name === 'ValidationError') {
    return {
      status: 400,
      code: 'VALIDATION_ERROR',
      // ValidationError messages are user-safe by construction.
      message: (error && error.message) || ENVELOPE_COPY.VALIDATION_ERROR,
      retryAfterSeconds: null,
    };
  }
  if (name === 'RateLimitError') {
    return {
      status: 429,
      code: 'RATE_LIMIT_ERROR',
      message: ENVELOPE_COPY.RATE_LIMIT_ERROR,
      retryAfterSeconds: (error && error.retryAfterSeconds) || null,
    };
  }
  if (name === 'AdviceGenerationError') {
    return {
      status: 503,
      code: 'ADVICE_GENERATION_ERROR',
      message: ENVELOPE_COPY.ADVICE_GENERATION_ERROR,
      retryAfterSeconds: null,
    };
  }
  return {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: ENVELOPE_COPY.INTERNAL_ERROR,
    retryAfterSeconds: null,
  };
}

/** HTTP status for each wire envelope code — used when copy comes from a template. */
const STATUS_FOR_CODE = {
  VALIDATION_ERROR: 400,
  RATE_LIMIT_ERROR: 429,
  ADVICE_GENERATION_ERROR: 503,
  INTERNAL_ERROR: 500,
  [RETRIEVAL_UNAVAILABLE]: 503,
};

/** Build the JSON response body for an envelope + support reference. */
function buildEnvelopeBody({ code, message }, supportReference) {
  return { error: code, message, supportReference };
}

module.exports = {
  ENVELOPE_COPY,
  STAGE_TEMPLATES,
  STATUS_FOR_CODE,
  mapErrorToEnvelope,
  buildEnvelopeBody,
};
