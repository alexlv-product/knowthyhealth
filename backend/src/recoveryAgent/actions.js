/**
 * actions.js — the allowlisted recovery actions, their executors, and the dispatcher.
 *
 * The model selects a tool in agentClient; `dispatch` validates the chosen name against
 * ALLOWLIST (in code) and runs the matching executor. Each executor returns a DIRECTIVE
 * the caller acts on — `kind` is one of:
 *   'respond'  → terminal: send { status, body, headers } to the client and stop.
 *   'retry'    → re-execute the failed stage once, then continue the pipeline.
 *   'fallback' → continue the pipeline in the named degraded `mode`.
 * Plus the audit fields escalate() logs: { supportReference, classification,
 * reasoningExcerpt, toolInvoked, toolParams, outcome }.
 *
 * The CONTROLLER carries out retry/fallback (it owns the stage functions + args); the
 * executor only validates that the chosen action is permissible here and shapes the
 * directive. This is the in-code enforcement of the allowlist + per-stage constraints.
 *
 * Constraints (PRD + design note):
 *   retry_request      max 1 retry cycle/request (ctx.retryCount guard); else degrades.
 *   activate_fallback  ONLY at upstream stages (intake/citations) and ONLY the existing
 *                      degradation modes — no new content shaping. Invalid → throws,
 *                      so escalate() falls to the static floor.
 *   fail_gracefully    stage-specific template; the mandatory floor, always available.
 */

const { newSupportReference } = require('../utils/errors');
const { STAGE_TEMPLATES, STATUS_FOR_CODE } = require('./templates');

const ALLOWLIST = Object.freeze([
  'retry_request',
  'activate_fallback',
  'fail_gracefully',
  'log_diagnosis',
]);

const FALLBACK_MODES = Object.freeze(['proceed_without_intake_context']);

// The single legitimate degradation mode per stage. Citations is absent on purpose:
// empty retrieval is handled deterministically in the controllers (retry → alert),
// not degraded to an all-F readout, so activate_fallback is only valid at intake.
const STAGE_FALLBACK_MODE = Object.freeze({
  intake: 'proceed_without_intake_context',
});

/** True if the model-selected action name is permitted. Enforced in code. */
function isAllowed(action) {
  return ALLOWLIST.includes(action);
}

const ref = (ctx) => (ctx && ctx.supportReference) || newSupportReference();

/**
 * fail_gracefully — terminal, stage-specific user-facing envelope. Always available;
 * never throws. The mandatory floor.
 */
function failGracefully(decision, error, context, ctx) {
  const tpl = STAGE_TEMPLATES[context.stage] || STAGE_TEMPLATES.unknown;
  const supportReference = ref(ctx);
  return {
    kind: 'respond',
    status: STATUS_FOR_CODE[tpl.code] || 500,
    body: { error: tpl.code, message: tpl.message, supportReference },
    headers: {},
    supportReference,
    classification: decision.classification,
    reasoningExcerpt: decision.reasoning,
    toolInvoked: 'fail_gracefully',
    toolParams: null,
    outcome: 'failed',
  };
}

/**
 * retry_request — directive to re-run the failed stage once. Bounded to a single retry
 * cycle: if one was already spent (ctx.retryCount ≥ 1) it degrades to fail_gracefully.
 */
function retryRequest(decision, error, context, ctx) {
  if ((ctx && ctx.retryCount) >= 1) return failGracefully(decision, error, context, ctx);
  return {
    kind: 'retry',
    supportReference: ref(ctx),
    classification: decision.classification,
    reasoningExcerpt: decision.reasoning,
    toolInvoked: 'retry_request',
    toolParams: null,
    outcome: 'retrying',
  };
}

/**
 * activate_fallback — directive to continue in the stage's pre-defined degraded mode.
 * Only valid at intake/citations; the mode is coerced to the one mode that stage
 * supports (the model's mode must at least be in FALLBACK_MODES). Anything else throws,
 * so escalate() falls to the static floor (e.g. a readout failure has nothing to
 * degrade to).
 */
function activateFallback(decision, error, context, ctx) {
  const expected = STAGE_FALLBACK_MODE[context.stage];
  if (!expected) throw new Error(`activate_fallback not valid at stage: ${context.stage}`);
  const requested = decision.params && decision.params.mode;
  if (requested && !FALLBACK_MODES.includes(requested)) {
    throw new Error(`invalid fallback mode: ${requested}`);
  }
  return {
    kind: 'fallback',
    mode: expected, // the one mode this stage supports
    supportReference: ref(ctx),
    classification: decision.classification,
    reasoningExcerpt: decision.reasoning,
    toolInvoked: 'activate_fallback',
    toolParams: { mode: expected },
    outcome: 'degraded',
  };
}

/**
 * Validate the model's chosen action and run its executor. Never invents an action —
 * a name outside ALLOWLIST throws (→ escalate falls to the static floor).
 *
 * @returns {Promise<object>} a directive (see file header)
 */
async function dispatch(decision, error, context, ctx) {
  if (!isAllowed(decision.action)) {
    throw new Error(`disallowed action: ${decision.action}`);
  }
  switch (decision.action) {
    case 'fail_gracefully':
      return failGracefully(decision, error, context, ctx);
    case 'retry_request':
      return retryRequest(decision, error, context, ctx);
    case 'activate_fallback':
      return activateFallback(decision, error, context, ctx);
    default:
      throw new Error(`unhandled action: ${decision.action}`);
  }
}

module.exports = {
  ALLOWLIST,
  FALLBACK_MODES,
  isAllowed,
  dispatch,
  failGracefully,
  retryRequest,
  activateFallback,
};
