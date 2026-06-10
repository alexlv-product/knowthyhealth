/**
 * adviceGenerator.js — SAD §3.2.6, Claude Call 2 (always fires).
 *
 * Assembles the advice prompt, calls Claude, parses + schema-validates the JSON
 * response, and returns it. There is NO graceful degradation here: a 429 throws
 * RateLimitError (→ 429) and any other failure throws AdviceGenerationError
 * (→ 503). The controller surfaces those as errors to the user.
 */

const Anthropic = require('@anthropic-ai/sdk');
const { parse: partialParse } = require('partial-json');
const { buildAdvicePrompt } = require('../utils/promptBuilder');
const { extractText, safeJsonParse, is429, retryAfterSeconds } = require('../utils/aiHelpers');
const { RateLimitError, AdviceGenerationError } = require('../utils/errors');

const MODEL = 'claude-haiku-4-5'; // Call 2 readout — Haiku for ~2x faster generation
const MAX_TOKENS = 16000; // Flag #6
const TIMEOUT_MS = 180_000; // Flag #7
const VALID_GRADES = ['A', 'B', 'C', 'D', 'F'];

const DEFAULT_DISCLAIMER =
  'This information is provided for general wellness and educational purposes only. ' +
  'It does not constitute medical advice, diagnosis, or treatment. Always consult a ' +
  'qualified healthcare professional before making changes to your diet, exercise ' +
  'routine, or health management.';

const client = new Anthropic();

/**
 * Parse the model's final text into an object, tolerantly. safeJsonParse strips
 * fences and parses strictly; if that fails (a faster model occasionally emits a
 * stray trailing fence or a minor malformation), fall back to a best-effort
 * partial-JSON parse from the first '{'. Throws only when nothing usable parses.
 */
function parseAdviceText(finalText) {
  try {
    return safeJsonParse(finalText);
  } catch (strictErr) {
    const start = String(finalText).indexOf('{');
    if (start !== -1) {
      try {
        const recovered = partialParse(String(finalText).slice(start));
        if (recovered && typeof recovered === 'object') return recovered;
      } catch {
        /* fall through to the strict error below */
      }
    }
    throw new AdviceGenerationError(`Advice response was not valid JSON: ${strictErr.message}`);
  }
}

/**
 * Coerce a parsed advice object into the exact response shape, filling any field
 * the model omitted with a safe default. A faster model (Haiku) sometimes drops a
 * field on a card; coercing means that degrades to an empty field rather than a
 * hard 503 for the whole readout. Cards with no headline are dropped as unusable.
 */
const str = (v) => (typeof v === 'string' ? v : '');
const arr = (v) => (Array.isArray(v) ? v : []);

/** Coerce a single raw card into the full card shape, filling missing fields. */
function coerceCard(c) {
  const card = c && typeof c === 'object' ? c : {};
  const grade = VALID_GRADES.includes(card.confidenceGrade) ? card.confidenceGrade : 'F';
  return {
    domain: str(card.domain) || 'General',
    headline: str(card.headline),
    takeaway: str(card.takeaway),
    recommendation: str(card.recommendation),
    reasoning: str(card.reasoning),
    symptomRelevance: arr(card.symptomRelevance).filter((x) => typeof x === 'string'),
    mechanism: str(card.mechanism),
    caveats: str(card.caveats),
    citations: arr(card.citations).filter((x) => x && typeof x === 'object'),
    confidenceGrade: grade,
    gradeRationale: str(card.gradeRationale),
    noEvidenceCaveat:
      typeof card.noEvidenceCaveat === 'string'
        ? card.noEvidenceCaveat
        : grade === 'F'
          ? 'No supporting evidence was found for this item.'
          : null,
  };
}

function coerceAdvice(parsed) {
  const obj = parsed && typeof parsed === 'object' ? parsed : {};
  const cards = arr(obj.cards).map(coerceCard).filter((c) => c.headline);
  return {
    cards,
    summary: str(obj.summary),
    evidence: arr(obj.evidence).filter((x) => x && typeof x === 'object'),
    disclaimer: str(obj.disclaimer) || DEFAULT_DISCLAIMER,
    conditionWarning: typeof obj.conditionWarning === 'string' ? obj.conditionWarning : null,
  };
}

/** Throw AdviceGenerationError if the parsed object isn't the expected shape. */
function assertSchema(r) {
  const fail = (m) => {
    throw new AdviceGenerationError(`Malformed advice response: ${m}`);
  };
  if (typeof r !== 'object' || r === null) fail('not an object');
  if (!Array.isArray(r.cards) || r.cards.length === 0) fail('cards[] missing or empty');
  r.cards.forEach((c, i) => {
    // v1.4 domain-grouped card with T1/T2/T3 content (§1.1, §2.3).
    if (typeof c.domain !== 'string') fail(`card[${i}].domain`);
    if (typeof c.headline !== 'string') fail(`card[${i}].headline`);
    if (typeof c.takeaway !== 'string') fail(`card[${i}].takeaway`);
    if (typeof c.recommendation !== 'string') fail(`card[${i}].recommendation`);
    if (typeof c.reasoning !== 'string') fail(`card[${i}].reasoning`);
    if (!Array.isArray(c.symptomRelevance)) fail(`card[${i}].symptomRelevance`);
    if (typeof c.mechanism !== 'string') fail(`card[${i}].mechanism`);
    if (typeof c.caveats !== 'string') fail(`card[${i}].caveats`);
    if (!Array.isArray(c.citations)) fail(`card[${i}].citations`);
    // citation.type is normalised (not failed) in citationValidator.
    if (!VALID_GRADES.includes(c.confidenceGrade)) fail(`card[${i}].confidenceGrade`);
    if (typeof c.gradeRationale !== 'string') fail(`card[${i}].gradeRationale`);
    if (!('noEvidenceCaveat' in c)) fail(`card[${i}].noEvidenceCaveat`);
  });
  if (typeof r.summary !== 'string') fail('summary');
  if (!Array.isArray(r.evidence)) fail('evidence[]');
  if (typeof r.disclaimer !== 'string') fail('disclaimer');
  if (!('conditionWarning' in r)) fail('conditionWarning');
}

/**
 * @param {object} profile sanitised profile (gender + ageRange required)
 * @param {Array} citations Tavily citations (may be [])
 * @param {object|null} intakeContext Call 1 output or null
 * @param {boolean} tavilyFailed
 * @param {boolean} [degradedConditionContext]
 * @returns {Promise<object>} validated AdviceResponse
 */
async function generateAdvice(profile, citations, intakeContext, tavilyFailed, degradedConditionContext = false) {
  const { system, user } = buildAdvicePrompt(
    profile,
    citations,
    intakeContext,
    tavilyFailed,
    degradedConditionContext
  );

  let message;
  try {
    message = await client.messages.create(
      {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system,
        messages: [{ role: 'user', content: user }],
      },
      { timeout: TIMEOUT_MS, maxRetries: 0 }
    );
  } catch (err) {
    if (is429(err)) {
      throw new RateLimitError('Anthropic rate limit during advice generation', retryAfterSeconds(err));
    }
    throw new AdviceGenerationError(`Advice generation request failed: ${err.message}`);
  }

  const advice = coerceAdvice(parseAdviceText(extractText(message)));
  assertSchema(advice); // final guard — passes after coercion unless cards is empty
  return advice;
}

/**
 * Streaming variant of generateAdvice (Option B). As Claude writes the JSON, this
 * detects each card the moment its object is COMPLETE (a later card has started,
 * so the object closed) and hands the coerced card to `onCard`. The caller then
 * validates that card's citations and pushes it to the client — so the UI only
 * ever shows complete, about-to-be-verified cards, never half-written text.
 *
 * The very last card is not emitted here (we can't tell it's closed mid-stream);
 * it arrives in the final validated response returned to the caller.
 *
 * Same error contract: 429 → RateLimitError, anything else → AdviceGenerationError.
 *
 * @param {function(object, number):void} onCard called with each completed,
 *   coerced card (and its index) as soon as it finishes streaming
 */
async function generateAdviceStream(
  profile,
  citations,
  intakeContext,
  tavilyFailed,
  degradedConditionContext = false,
  onCard = () => {},
  signal = undefined
) {
  const { system, user } = buildAdvicePrompt(
    profile,
    citations,
    intakeContext,
    tavilyFailed,
    degradedConditionContext
  );

  let accumulated = '';
  let emitted = 0;
  // On each chunk, partial-parse what we have and emit any newly-COMPLETE card.
  // A card is complete once a later card exists in the array (its object closed),
  // so we never emit the still-writing last element — no half-formed cards.
  const flushCompleteCards = () => {
    const start = accumulated.indexOf('{'); // skip any leading ```json fence
    if (start === -1) return;
    let obj;
    try {
      obj = partialParse(accumulated.slice(start));
    } catch {
      return;
    }
    const rawCards = obj && Array.isArray(obj.cards) ? obj.cards : [];
    const completeCount = Math.max(0, rawCards.length - 1);
    for (; emitted < completeCount; emitted++) {
      const rc = rawCards[emitted];
      if (rc && typeof rc === 'object') {
        try {
          onCard(coerceCard(rc), emitted);
        } catch {
          /* a consumer (closed connection) must never break generation */
        }
      }
    }
  };

  let finalText;
  try {
    const stream = client.messages.stream(
      {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system,
        messages: [{ role: 'user', content: user }],
      },
      { timeout: TIMEOUT_MS, maxRetries: 0, signal }
    );
    stream.on('text', (delta) => {
      accumulated += delta;
      flushCompleteCards();
    });
    // The SDK stream is an EventEmitter: an unhandled 'error' event would crash
    // the process. We swallow it here because the same failure also rejects
    // finalMessage() below, which is where we actually handle it.
    stream.on('error', () => {});
    const finalMessage = await stream.finalMessage();
    finalText = extractText(finalMessage);
  } catch (err) {
    if (is429(err)) {
      throw new RateLimitError('Anthropic rate limit during advice generation', retryAfterSeconds(err));
    }
    throw new AdviceGenerationError(`Advice generation request failed: ${err.message}`);
  }

  const advice = coerceAdvice(parseAdviceText(finalText));
  assertSchema(advice); // final guard — passes after coercion unless cards is empty
  return advice;
}

module.exports = { generateAdvice, generateAdviceStream };
