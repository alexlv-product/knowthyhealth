/**
 * errorAgent/index.js — entry point for the error-handling agent.
 *
 * Two surfaces:
 *   - errorAgentMiddleware(err, req, res, next): the global Express choke point.
 *     Replaces the bare 500 handler with an audited one. (Day 1 wiring.)
 *   - escalate(error, ctx): the per-stage hook the controllers will call to hand
 *     a stage failure to the agent. (Stage hooks land with the agent in Day 2-3.)
 *
 * Day 2 status: the AGENT is ON. escalate() runs the model classifier
 * (agentClient) under the 3s budget, dispatches its chosen allowlisted action,
 * and falls to the mandatory static FLOOR on any agent failure, budget
 * exhaustion, or recursion-guard trip. `fail_gracefully` is implemented
 * end-to-end; `retry_request` / `activate_fallback` degrade to the floor until
 * their Day 3 executors land (the model's choice is still classified + audited).
 *
 * Safety rails (PRD): 3s budget, recursion guard (the agent's own model call is
 * NOT routed back through escalate), zero happy-path overhead (this module is
 * only touched on a throw).
 */

const { assembleContext } = require('./contextAssembler');
const { logIncident } = require('./auditLogger');
const { mapErrorToEnvelope, buildEnvelopeBody } = require('./templates');
const { newSupportReference } = require('../utils/errors');

const AGENT_ENABLED = true; // Day 2: model classifier on; static floor guards it.
const BUDGET_MS = 3000; // total agent latency budget (PRD hard rail)

/** Race a promise against the remaining budget; reject if it overruns. */
function withBudget(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('agent budget exceeded')), Math.max(0, ms));
    Promise.resolve(promise).then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

/**
 * The guaranteed floor: deterministic, model-free resolution of an error into a
 * terminal wire envelope. Never throws. This is what budget exhaustion, the
 * recursion guard, and any agent failure all resolve to.
 *
 * @returns {{ kind:'respond', status, body, headers, classification, toolInvoked, outcome }}
 */
function staticResolution(error, ctx = {}) {
  const env = mapErrorToEnvelope(error);
  const supportReference = ctx.supportReference || newSupportReference();
  const headers = {};
  if (env.retryAfterSeconds) headers['Retry-After'] = String(env.retryAfterSeconds);
  return {
    kind: 'respond',
    status: env.status,
    body: buildEnvelopeBody(env, supportReference),
    headers,
    supportReference,
    classification: null, // leave null so a prior agent decision's label can still be logged
    toolInvoked: 'static_fallback',
    outcome: 'failed',
  };
}

/**
 * Coerce a directive to a terminal HTTP response. A retry/fallback directive can't
 * be honored at a terminal call site (the global middleware), so it collapses to the
 * static floor — reusing the directive's supportReference so the response lines up
 * with the already-logged incident.
 *
 * @returns {{ status, body, headers }}
 */
function resolveToResponse(directive, error) {
  if (directive && directive.kind === 'respond') {
    return { status: directive.status, body: directive.body, headers: directive.headers || {} };
  }
  const s = staticResolution(error, { supportReference: directive && directive.supportReference });
  return { status: s.status, body: s.body, headers: s.headers };
}

/**
 * Hand a (stage or global) error to the agent and get back a DIRECTIVE for the
 * caller to act on: 'respond' (terminal envelope), 'retry' (re-run the stage), or
 * 'fallback' (continue in the named degraded mode). Logs the incident before
 * returning. NEVER throws — any internal failure (incl. the agent's own model
 * call) collapses to the static-floor 'respond'.
 *
 * Stage hooks act on the directive's `kind`; terminal call sites (the global
 * middleware) pass it through `resolveToResponse`.
 *
 * @param {Error} error
 * @param {object} [ctx] { req, stage, retryCount, providerMeta, supportReference }
 * @returns {Promise<object>} a directive (see file header / actions.js)
 */
async function escalate(error, ctx = {}) {
  const startedAt = Date.now();
  const context = assembleContext(error, ctx);

  let decision = null;
  let resolution = null;
  if (AGENT_ENABLED) {
    try {
      // The agent's own model call lives in agentClient and is NOT routed back
      // through escalate(), so there is no recursion. Both the classification and
      // the dispatch are raced against the (shared) latency budget; any rejection
      // — budget exhaustion, a 429 from the agent's own call, a disallowed action
      // — falls through to the static floor below.
      const { classifyAndDecide } = require('./agentClient');
      const { dispatch } = require('./actions');
      decision = await withBudget(classifyAndDecide(context, ctx), BUDGET_MS);
      const remaining = BUDGET_MS - (Date.now() - startedAt);
      resolution = await withBudget(dispatch(decision, error, context, ctx), remaining);
    } catch {
      resolution = null; // any agent failure → static floor
    }
  }
  if (!resolution) resolution = staticResolution(error, ctx);

  logIncident({
    ref: resolution.supportReference,
    context,
    // Prefer the resolution's label; fall back to the decision's so a static-floor
    // resolution still records what the model classified, if it got that far.
    classification: resolution.classification ?? (decision && decision.classification) ?? null,
    reasoningExcerpt: resolution.reasoningExcerpt ?? (decision && decision.reasoning) ?? null,
    toolInvoked: resolution.toolInvoked,
    toolParams: resolution.toolParams ?? (decision && decision.params) ?? null,
    outcome: resolution.outcome,
    handlingLatencyMs: Date.now() - startedAt,
  });

  return resolution;
}

/**
 * Global Express error-handling middleware — the single choke point for any
 * error that reaches the end of the chain. Audited replacement for the bare 500
 * handler in server.js. Only runs on a thrown/forwarded error (zero happy-path
 * overhead). No stage context here, so it is the floor: classify-to-envelope.
 */
// eslint-disable-next-line no-unused-vars
async function errorAgentMiddleware(err, req, res, next) {
  if (res.headersSent) return next(err); // mid-stream (SSE) — leave to that path (V2)
  const directive = await escalate(err, { req, stage: 'unknown' });
  const { status, body, headers } = resolveToResponse(directive, err);
  if (headers) for (const [k, v] of Object.entries(headers)) res.set(k, v);
  return res.status(status).json(body);
}

module.exports = { escalate, resolveToResponse, errorAgentMiddleware, AGENT_ENABLED, BUDGET_MS };
