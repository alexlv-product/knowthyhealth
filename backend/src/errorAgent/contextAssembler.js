/**
 * contextAssembler.js — builds the privacy-safe incident context the agent
 * classifies from (and the audit log records).
 *
 * PRIVACY INVARIANT (extends Flag #10 / SAD §7.2): this context — and anything
 * derived from it that reaches the model or the logs — may carry the error
 * class/message, a trimmed stack, the route, the pipeline stage, the payload
 * *shape* (keys + value TYPES, never values), the retry count, and provider
 * response metadata (status, retry-after). It must NEVER carry raw
 * healthCondition text, demographic values, or any field value. Error messages
 * originate in our own code and are user-safe by construction.
 */

const STACK_LINES = 8; // enough to locate the throw; not the whole trace
const MSG_MAX = 300;

/** typeof-ish tag for a single value — type only, never the value itself. */
function shapeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `array(${value.length})`;
  return typeof value;
}

/**
 * Derive the payload SHAPE: each top-level key mapped to its value's type. Never
 * includes any value. e.g. { gender: 'string', symptoms: 'array(2)', age: 'number' }.
 */
function payloadShape(body) {
  if (!body || typeof body !== 'object') return {};
  const shape = {};
  for (const key of Object.keys(body)) shape[key] = shapeOf(body[key]);
  return shape;
}

/** First N lines of the stack, trimmed — locates the throw without dumping it all. */
function trimStack(error) {
  if (!error || typeof error.stack !== 'string') return null;
  return error.stack.split('\n').slice(0, STACK_LINES).join('\n');
}

/**
 * A stable, low-cardinality fingerprint for grouping like incidents:
 * "<ErrorName>@<stage>:<first stack frame>". No request-specific data.
 */
function errorFingerprint(error, stage) {
  const name = (error && error.name) || 'Error';
  const frame =
    error && typeof error.stack === 'string'
      ? (error.stack.split('\n')[1] || '').trim().replace(/^at\s+/, '').slice(0, 80)
      : '';
  return `${name}@${stage}${frame ? `:${frame}` : ''}`;
}

/**
 * @param {Error} error the thrown error
 * @param {object} opts
 * @param {object} [opts.req] Express request (for route/method/body shape)
 * @param {string} [opts.stage] pipeline stage: intake|citations|readout|unknown
 * @param {number} [opts.retryCount] retries already attempted for this request
 * @param {object} [opts.providerMeta] { status, retryAfterSeconds } from an upstream
 * @returns {object} privacy-safe context
 */
function assembleContext(error, { req = null, stage = 'unknown', retryCount = 0, providerMeta = null } = {}) {
  const message = error && typeof error.message === 'string' ? error.message.slice(0, MSG_MAX) : '';
  return {
    stage,
    errorName: (error && error.name) || 'Error',
    errorMessage: message,
    errorFingerprint: errorFingerprint(error, stage),
    stack: trimStack(error),
    route: req ? `${req.method} ${req.path || req.url}` : null,
    payloadShape: req ? payloadShape(req.body) : {},
    retryCount,
    providerMeta: providerMeta || null,
  };
}

module.exports = { assembleContext, payloadShape, errorFingerprint, shapeOf };
