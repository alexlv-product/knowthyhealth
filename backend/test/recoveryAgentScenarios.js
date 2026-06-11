/**
 * recoveryAgentScenarios.js — failure-injection harness for the PRD acceptance scenarios
 * (KTH Recovery Agent §Success Criteria) plus the retrieval-failure UX policy.
 * Run: `node test/recoveryAgentScenarios.js` (or `npm run test:recovery`).
 *
 * It drives the REAL adviceController with the REAL recoveryAgent wiring, but injects
 * deterministic stage failures and a deterministic agent DECISION (no live Anthropic
 * call — fast, never flaky). Each scenario asserts the user-facing response AND, where
 * the agent is involved, that the [recoveryAgent] audit log tells the decision story.
 *
 * Mechanism: the service modules are mutated to thin wrappers that dispatch to a
 * per-scenario behavior fn BEFORE the controller is required (so the controller's
 * destructured refs capture the wrappers). agentClient.classifyAndDecide is overridden
 * per scenario (escalate re-reads it on every call).
 *
 * Note the design split exercised here: citation-retrieval failure is handled
 * DETERMINISTICALLY (retry once → alert; the agent is NOT consulted), while intake and
 * readout failures go through the agent.
 */

const intake = require('../src/services/intakeProcessor');
const fetcher = require('../src/services/citationFetcher');
const generator = require('../src/services/adviceGenerator');
const inputValidator = require('../src/utils/inputValidator');
const agentClient = require('../src/recoveryAgent/agentClient');
const { RateLimitError, AdviceGenerationError } = require('../src/utils/errors');

// ── Per-scenario injection points ─────────────────────────────────────────────
let behaviorIntake, behaviorFetch, behaviorGen;
intake.processIntake = (...a) => behaviorIntake(...a);
fetcher.fetchCitations = (...a) => behaviorFetch(...a);
generator.generateAdvice = (...a) => behaviorGen(...a);
inputValidator.validateInput = () => ({
  gender: 'female', ageRange: '45-54', symptoms: [], diet: null,
  activityLevel: null, sleepQuality: null, healthCondition: null,
});

// Controller must be required AFTER the mutations above.
const adviceController = require('../src/controllers/adviceController');

const URL = 'https://pubmed.ncbi.nlm.nih.gov/123';
const validAdvice = (url) => ({
  cards: [{
    domain: 'Sleep', headline: 'Magnesium and sleep', takeaway: 't', recommendation: 'r',
    reasoning: 're', symptomRelevance: [], mechanism: 'm', caveats: 'c',
    citations: [{ url, type: 'RCT', title: 'T' }], confidenceGrade: 'B',
    gradeRationale: 'g', noEvidenceCaveat: null,
  }],
  summary: 's', evidence: [{ url, type: 'RCT', title: 'T' }], disclaimer: 'd', conditionWarning: null,
});
const okIntake = async () => ({ researchTargets: ['sleep'], conditionCategory: null, contraindications: [], lifestyleFlags: [] });
const okFetch = async () => ({ citations: [{ url: URL, type: 'RCT', title: 'T' }], queryCount: 5 });
const noAgent = async () => { throw new Error('agent must NOT be consulted in this scenario'); };

// ── Log capture ───────────────────────────────────────────────────────────────
let captured = [];
const realInfo = console.info;
console.info = (tag, json) => {
  if (tag === '[advice]' || tag === '[recoveryAgent]') {
    try { captured.push({ tag, obj: JSON.parse(json) }); } catch { /* ignore */ }
  }
};
const advice = () => captured.filter((l) => l.tag === '[advice]').map((l) => l.obj);
const incidents = () => captured.filter((l) => l.tag === '[recoveryAgent]').map((l) => l.obj);

function makeRes() {
  return {
    _status: 0, _body: null, _headers: {},
    set(k, v) { this._headers[k] = v; return this; },
    status(s) { this._status = s; return this; },
    json(b) { this._body = b; return this; },
  };
}

let failures = 0;
function check(name, cond, detail) {
  if (cond) { realInfo(`  ✓ ${name}`); }
  else { failures++; realInfo(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
}

async function run(title, setup, assert) {
  captured = [];
  setup();
  const res = makeRes();
  await adviceController({ method: 'POST', path: '/api/v1/advice', body: {} }, res, (e) => { throw e; });
  realInfo(`\n${title}`);
  assert(res);
}

(async () => {
  // 1) Empty retrieval → DETERMINISTIC retry → success. The agent is not consulted.
  await run('1. Retrieval empty → deterministic retry → success', () => {
    behaviorIntake = okIntake;
    let n = 0;
    behaviorFetch = async () => (++n === 1 ? { citations: [], queryCount: 5 } : { citations: [{ url: URL, type: 'RCT', title: 'T' }], queryCount: 5 });
    behaviorGen = async () => validAdvice(URL);
    agentClient.classifyAndDecide = noAgent;
  }, (res) => {
    check('200 OK', res._status === 200, `got ${res._status}`);
    check('readout returned with a citation', res._body && res._body.cards && res._body.cards.length === 1);
    check('agent was NOT consulted for retrieval (no [recoveryAgent] incident)', incidents().length === 0);
  });

  // 2) Empty retrieval after the one retry → alert, never an all-F readout.
  await run('2. Retrieval still empty after retry → RETRIEVAL_UNAVAILABLE (no all-F)', () => {
    behaviorIntake = okIntake;
    behaviorFetch = async () => ({ citations: [], queryCount: 5 });
    behaviorGen = async () => { throw new Error('readout must NOT run with zero citations'); };
    agentClient.classifyAndDecide = noAgent;
  }, (res) => {
    check('503 RETRIEVAL_UNAVAILABLE', res._status === 503 && res._body.error === 'RETRIEVAL_UNAVAILABLE', `got ${res._status}/${res._body && res._body.error}`);
    check('NO all-F readout — no cards in the body', !res._body.cards);
    check('message tells the user the sources are unavailable', /sources/i.test(res._body.message));
    check('exactly two retrieval attempts were made', advice()[0] && advice()[0].tavilyQueries === 10, advice()[0] ? `got ${advice()[0].tavilyQueries}` : 'no [advice] log');
    check('agent was NOT consulted', incidents().length === 0);
  });

  // 3) Malformed intake JSON → agent fails gracefully with a stage-specific message.
  await run('3. Malformed intake → agent fail_gracefully', () => {
    behaviorIntake = async () => { throw new Error('Intake response was not valid JSON: Unexpected token'); };
    behaviorFetch = okFetch;
    behaviorGen = async () => validAdvice(URL);
    agentClient.classifyAndDecide = async () => ({ action: 'fail_gracefully', classification: 'malformed_model_output', reasoning: 'Model emitted invalid JSON; retry will not help.', params: {} });
  }, (res) => {
    const inc = incidents()[0];
    check('500 INTERNAL_ERROR', res._status === 500 && res._body.error === 'INTERNAL_ERROR', `got ${res._status}/${res._body && res._body.error}`);
    check('user message is intake-stage specific', /intake/i.test(res._body.message));
    check('audit: intake stage, fail_gracefully, classified', inc && inc.stage === 'intake' && inc.toolInvoked === 'fail_gracefully' && inc.classification === 'malformed_model_output');
  });

  // 4) Rate-limit at readout → agent retries → success.
  await run('4. Readout rate-limit → agent retry → success', () => {
    behaviorIntake = okIntake;
    behaviorFetch = okFetch;
    let n = 0;
    behaviorGen = async () => { if (++n === 1) throw new RateLimitError('upstream 429', 3); return validAdvice(URL); };
    agentClient.classifyAndDecide = async () => ({ action: 'retry_request', classification: 'rate_limit', reasoning: 'A single backoff retry should clear the 429.', params: {} });
  }, (res) => {
    const inc = incidents()[0];
    check('200 OK after retry', res._status === 200, `got ${res._status}`);
    check('audit: readout stage, retry_request, rate_limit', inc && inc.stage === 'readout' && inc.toolInvoked === 'retry_request' && inc.classification === 'rate_limit');
  });

  // 5) Crash the agent itself → static fallback fires; user never sees a raw error.
  await run('5. Agent crashes → static fallback', () => {
    behaviorIntake = okIntake;
    behaviorFetch = okFetch;
    behaviorGen = async () => { throw new AdviceGenerationError('readout generation failed'); };
    agentClient.classifyAndDecide = async () => { throw new Error('agent model call 529'); };
  }, (res) => {
    const inc = incidents()[0];
    check('503 ADVICE_GENERATION_ERROR (original contract preserved)', res._status === 503 && res._body.error === 'ADVICE_GENERATION_ERROR', `got ${res._status}/${res._body && res._body.error}`);
    check('no raw error leaked — opaque envelope only', !!res._body.supportReference && !/stack|readout generation failed/i.test(JSON.stringify(res._body)));
    check('audit: static_fallback recorded', inc && inc.toolInvoked === 'static_fallback');
  });

  // 6) Audit log is reviewable and tells the story without code access.
  await run('6. Audit record is reviewable (full schema, no PII)', () => {
    behaviorIntake = async () => { throw new Error('Intake response was not valid JSON'); };
    behaviorFetch = okFetch;
    behaviorGen = async () => validAdvice(URL);
    agentClient.classifyAndDecide = async () => ({ action: 'fail_gracefully', classification: 'malformed_model_output', reasoning: 'invalid json', params: {} });
  }, () => {
    const inc = incidents()[0];
    const keys = ['ts', 'ref', 'stage', 'errorFingerprint', 'contextSummary', 'classification', 'reasoningExcerpt', 'toolInvoked', 'outcome', 'handlingLatencyMs'];
    check('incident has the full reviewable schema', inc && keys.every((k) => k in inc), inc ? `missing: ${keys.filter((k) => !(k in inc)).join(',')}` : 'no incident');
    check('contextSummary carries payload SHAPE only, no values', inc && inc.contextSummary && typeof inc.contextSummary.payloadShape === 'object' && !JSON.stringify(inc.contextSummary).includes('female'));
    check('[advice] and [recoveryAgent] share the support reference', inc && advice()[0] && inc.ref === advice()[0].ref);
  });

  console.info = realInfo;
  realInfo(`\n${failures === 0 ? 'ALL SCENARIOS PASS' : failures + ' CHECK(S) FAILED'}`);
  process.exit(failures === 0 ? 0 : 1);
})();
