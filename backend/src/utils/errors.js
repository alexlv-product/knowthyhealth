/**
 * Typed error classes shared across the backend.
 *
 * The controller maps these to HTTP responses (API Design §2.6 / §7):
 *   ValidationError        → 400 VALIDATION_ERROR
 *   RateLimitError         → 429 RATE_LIMIT_ERROR
 *   AdviceGenerationError  → 503 ADVICE_GENERATION_ERROR
 *   (anything else)        → 500 INTERNAL_ERROR (global handler)
 *
 * Keeping them in one module lets every service throw a typed error and the
 * controller switch on `instanceof` without circular imports.
 */

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

class RateLimitError extends Error {
  /** @param {number|null} [retryAfterSeconds] forwarded from the upstream 429 */
  constructor(message, retryAfterSeconds = null) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

class AdviceGenerationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AdviceGenerationError';
  }
}

/**
 * Short opaque support reference (PRD v1.4 §5.2). The ONLY diagnostic detail an
 * error response may expose to the client — a user can quote it when reporting
 * an issue, and the server logs the same code alongside the (log-only) stage,
 * timestamp, and counts so the two can be correlated. Never exposes pipeline
 * stage names, request IDs, timestamps, or upstream status to the client.
 */
function newSupportReference() {
  // 6 chars, lowercase base36 (e.g. "8h2k3m"). Opaque, not a real request id.
  return Math.random().toString(36).slice(2, 8).padEnd(6, '0');
}

module.exports = {
  ValidationError,
  RateLimitError,
  AdviceGenerationError,
  newSupportReference,
};
