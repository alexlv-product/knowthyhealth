/**
 * adviceGenerator.js — SAD §3.2.6, Claude Call 2 (always fires).
 *
 * Assembles the advice prompt, calls Claude, parses + schema-validates the JSON
 * response, and returns it. There is NO graceful degradation here: a 429 throws
 * RateLimitError (→ 429) and any other failure throws AdviceGenerationError
 * (→ 503). The controller surfaces those as errors to the user.
 */

const Anthropic = require('@anthropic-ai/sdk');
const { buildAdvicePrompt } = require('../utils/promptBuilder');
const { extractText, safeJsonParse, is429, retryAfterSeconds } = require('../utils/aiHelpers');
const { RateLimitError, AdviceGenerationError } = require('../utils/errors');

const MODEL = 'claude-sonnet-4-6'; // Build Handoff MODEL NOTE
const MAX_TOKENS = 16000; // Flag #6
const TIMEOUT_MS = 180_000; // Flag #7
const VALID_GRADES = ['A', 'B', 'C', 'D', 'F'];

const client = new Anthropic();

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

  let parsed;
  try {
    parsed = safeJsonParse(extractText(message));
  } catch (err) {
    throw new AdviceGenerationError(`Advice response was not valid JSON: ${err.message}`);
  }

  assertSchema(parsed);
  return parsed;
}

module.exports = { generateAdvice };
