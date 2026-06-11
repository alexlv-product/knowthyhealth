/**
 * auditLogger.js — the structured incident record. This is the demo artifact and
 * the interview exhibit: it must tell the decision story without code access.
 *
 * One JSON line per incident under the `[errorAgent]` tag, mirroring the existing
 * `[advice]` log style and reusing the request's supportReference as the
 * correlation id so an agent incident lines up with its pipeline log entry.
 *
 * Logged fields are the privacy-safe context plus the agent's decision. Same
 * invariant as contextAssembler: no field values, no PII — only shape/metadata.
 */

/**
 * @param {object} record
 * @param {string} record.ref            supportReference (correlation id)
 * @param {object} record.context        output of assembleContext (already safe)
 * @param {string} [record.classification]  agent's root-cause label
 * @param {string} [record.reasoningExcerpt] short agent reasoning (<= a sentence or two)
 * @param {string} record.toolInvoked    action chosen (retry_request|activate_fallback|fail_gracefully|static_fallback)
 * @param {object} [record.toolParams]   parameters passed to the action
 * @param {string} record.outcome        resolved|degraded|failed|retried
 * @param {number} record.handlingLatencyMs  end-to-end agent handling time
 */
function logIncident(record) {
  const ctx = record.context || {};
  const line = {
    ts: new Date().toISOString(),
    ref: record.ref || null,
    stage: ctx.stage || 'unknown',
    errorFingerprint: ctx.errorFingerprint || null,
    contextSummary: {
      errorName: ctx.errorName,
      route: ctx.route,
      payloadShape: ctx.payloadShape,
      retryCount: ctx.retryCount,
      providerMeta: ctx.providerMeta,
    },
    classification: record.classification || null,
    reasoningExcerpt: record.reasoningExcerpt || null,
    toolInvoked: record.toolInvoked || null,
    toolParams: record.toolParams || null,
    outcome: record.outcome || null,
    handlingLatencyMs: typeof record.handlingLatencyMs === 'number' ? record.handlingLatencyMs : null,
  };
  console.info('[errorAgent]', JSON.stringify(line));
  return line;
}

module.exports = { logIncident };
