/**
 * recoveryAgentStreamScenarios.js — failure-injection harness for the recovery agent
 * on the STREAMING endpoint (adviceStreamController). Run: `npm run test:recovery:stream`.
 *
 * Streaming is the user-facing path, so V2 wired the agent into it at the intake and
 * readout stages (retrieval stays deterministic). The hard case is the readout: cards
 * stream incrementally (Option B), so a retry is only safe BEFORE the first card —
 * these scenarios lock that in. Same injection trick as the buffered harness: mutate
 * service modules to wrappers before requiring the controller; override the agent
 * decision per scenario. No live model/network calls.
 */

const intake = require('../src/services/intakeProcessor');
const fetcher = require('../src/services/citationFetcher');
const generator = require('../src/services/adviceGenerator');
const inputValidator = require('../src/utils/inputValidator');
const agentClient = require('../src/recoveryAgent/agentClient');
const { RateLimitError, AdviceGenerationError } = require('../src/utils/errors');

let behaviorIntake, behaviorFetch, behaviorStream;
intake.processIntake = (...a) => behaviorIntake(...a);
fetcher.fetchCitations = (...a) => behaviorFetch(...a);
generator.generateAdviceStream = (...a) => behaviorStream(...a);
inputValidator.validateInput = () => ({
  gender: 'female', ageRange: '45-54', symptoms: [], diet: null,
  activityLevel: null, sleepQuality: null, healthCondition: null,
});

const streamController = require('../src/controllers/adviceStreamController');

const URL = 'https://pubmed.ncbi.nlm.nih.gov/1';
const card = () => ({
  domain: 'Sleep', headline: 'h', takeaway: 't', recommendation: 'r', reasoning: 're',
  symptomRelevance: [], mechanism: 'm', caveats: 'c',
  citations: [{ url: URL, type: 'RCT', title: 'T' }], confidenceGrade: 'B',
  gradeRationale: 'g', noEvidenceCaveat: null,
});
const advice = () => ({ cards: [card()], summary: 's', evidence: [{ url: URL, type: 'RCT', title: 'T' }], disclaimer: 'd', conditionWarning: null });
const okIntake = async () => ({ researchTargets: ['sleep'], conditionCategory: null, contraindications: [], lifestyleFlags: [] });
const okFetch = async () => ({ citations: [{ url: URL, type: 'RCT', title: 'T' }], queryCount: 4 });
// generateAdviceStream stubs: args = (body, citations, intakeContext, tavilyFailed, degraded, onCard, signal)
const emitThenDone = async (...a) => { a[5](card(), 0); return advice(); };

function makeRes() {
  const frames = [];
  return {
    writableEnded: false, headersSent: false, _status: 0, frames,
    status(s) { this._status = s; return this; }, set() { return this; },
    flushHeaders() { this.headersSent = true; }, on() {},
    write(c) { frames.push(c); return true; }, end() { this.writableEnded = true; return this; },
  };
}
function events(res) {
  return res.frames.join('').split('\n\n').filter(Boolean).map((blk) => {
    const ev = (blk.match(/event: (\w+)/) || [])[1];
    const data = (blk.match(/data: (.*)/) || [])[1];
    return { ev, data: data ? JSON.parse(data) : null };
  });
}

let failures = 0;
const check = (n, c, d) => { if (c) console.log(`  ✓ ${n}`); else { failures++; console.log(`  ✗ ${n}${d ? ' — ' + d : ''}`); } };

async function run(title, setup, assert) {
  setup();
  const res = makeRes();
  await streamController({ method: 'POST', path: '/api/v1/advice/stream', body: {} }, res, (e) => { throw e; });
  console.log(`\n${title}`);
  assert(events(res), res);
}

(async () => {
  // 1) Happy path — agent stays dormant.
  await run('1. Happy path → cards stream, done', () => {
    behaviorIntake = okIntake; behaviorFetch = okFetch; behaviorStream = emitThenDone;
    agentClient.classifyAndDecide = async () => { throw new Error('agent must not be called'); };
  }, (evs) => {
    const names = evs.map((e) => e.ev);
    check('emits card then done', names.includes('card') && names.includes('done'), names.join(','));
    check('no error event', !names.includes('error'));
  });

  // 2) Intake fails → agent fail_gracefully → terminal SSE error (no cards).
  await run('2. Intake fails → agent fail_gracefully → error', () => {
    behaviorIntake = async () => { throw new Error('Intake response was not valid JSON'); };
    behaviorFetch = okFetch; behaviorStream = emitThenDone;
    agentClient.classifyAndDecide = async () => ({ action: 'fail_gracefully', classification: 'malformed_model_output', reasoning: 'x', params: {} });
  }, (evs) => {
    const names = evs.map((e) => e.ev);
    const err = evs.find((e) => e.ev === 'error');
    check('terminal error event, INTERNAL_ERROR', !!err && err.data.error === 'INTERNAL_ERROR');
    check('never reached writing/card/done', !names.includes('card') && !names.includes('done'));
  });

  // 3) Intake fails → agent retry → 2nd intake succeeds → completes.
  await run('3. Intake fails → agent retry → success', () => {
    let n = 0;
    behaviorIntake = async () => { if (++n === 1) throw new Error('transient intake'); return okIntake(); };
    behaviorFetch = okFetch; behaviorStream = emitThenDone;
    agentClient.classifyAndDecide = async () => ({ action: 'retry_request', classification: 'transient_provider_failure', reasoning: 'x', params: {} });
  }, (evs) => {
    const names = evs.map((e) => e.ev);
    check('completes with done, no error', names.includes('done') && !names.includes('error'), names.join(','));
  });

  // 4) Readout fails BEFORE any card → agent retry → 2nd attempt streams → done.
  await run('4. Readout fails pre-card → agent retry → success', () => {
    behaviorIntake = okIntake; behaviorFetch = okFetch;
    let n = 0;
    behaviorStream = async (...a) => { if (++n === 1) throw new RateLimitError('429', 3); return emitThenDone(...a); };
    agentClient.classifyAndDecide = async () => ({ action: 'retry_request', classification: 'rate_limit', reasoning: 'x', params: {} });
  }, (evs) => {
    const names = evs.map((e) => e.ev);
    check('retried and completed (done, no error)', names.includes('done') && !names.includes('error'), names.join(','));
    check('exactly one card emitted (no duplicate from retry)', names.filter((x) => x === 'card').length === 1);
  });

  // 5) Readout emits a card THEN fails → agent says retry, but unsafe → terminal error.
  await run('5. Readout fails AFTER first card → retry refused → terminal error', () => {
    behaviorIntake = okIntake; behaviorFetch = okFetch;
    behaviorStream = async (...a) => { a[5](card(), 0); throw new AdviceGenerationError('mid-stream failure'); };
    agentClient.classifyAndDecide = async () => ({ action: 'retry_request', classification: 'transient_provider_failure', reasoning: 'x', params: {} });
  }, (evs) => {
    const names = evs.map((e) => e.ev);
    const err = evs.find((e) => e.ev === 'error');
    check('one card streamed before the failure', names.filter((x) => x === 'card').length === 1);
    check('NO retry — exactly one card, not two', names.filter((x) => x === 'card').length === 1);
    check('terminal error (503), original contract preserved', !!err && err.data.error === 'ADVICE_GENERATION_ERROR');
    check('no done event', !names.includes('done'));
  });

  // 6) Readout fails pre-card, agent itself crashes → static floor → terminal 503.
  await run('6. Readout fails, agent crashes → static fallback error', () => {
    behaviorIntake = okIntake; behaviorFetch = okFetch;
    behaviorStream = async () => { throw new AdviceGenerationError('readout failed'); };
    agentClient.classifyAndDecide = async () => { throw new Error('agent 529'); };
  }, (evs) => {
    const err = evs.find((e) => e.ev === 'error');
    check('terminal error (503) via static floor', !!err && err.data.error === 'ADVICE_GENERATION_ERROR');
    check('no raw error leaked', !!err && !/mid-stream|readout failed/i.test(JSON.stringify(err.data)));
  });

  console.log(`\n${failures === 0 ? 'ALL STREAM SCENARIOS PASS' : failures + ' CHECK(S) FAILED'}`);
  process.exit(failures === 0 ? 0 : 1);
})();
