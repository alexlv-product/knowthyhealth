/**
 * conditionExtractor.js — SAD §3.2.4, Claude Call 1 (conditional).
 *
 * Extracts structured condition context from the raw healthCondition text. The
 * raw text enters Claude here and NOWHERE else — it is never sent to Tavily,
 * never returned to the client, and never logged in full (SAD §7.2).
 *
 * Throws RateLimitError on a 429 and a generic Error on any other failure. The
 * controller catches BOTH and degrades to conditionContext = null
 * (Build Handoff §3.4) — a Call 1 failure never fails the whole request.
 */

const Anthropic = require('@anthropic-ai/sdk');
const { buildConditionExtractionPrompt } = require('../utils/promptBuilder');
const { extractText, safeJsonParse, is429, retryAfterSeconds } = require('../utils/aiHelpers');
const { RateLimitError } = require('../utils/errors');

const MODEL = 'claude-sonnet-4-20250514'; // Build Handoff MODEL NOTE
const MAX_TOKENS = 1000; // Flag #6
const TIMEOUT_MS = 30_000; // Flag #7

const client = new Anthropic();

const MAX_CATEGORY = 60;
const MAX_ITEM = 80;
const MAX_ITEMS = 5;

function clampStr(v, max) {
  return typeof v === 'string' ? v.slice(0, max) : '';
}
function clampList(v) {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === 'string').slice(0, MAX_ITEMS).map((x) => clampStr(x, MAX_ITEM));
}

/**
 * @param {string} rawConditionText sanitised healthCondition
 * @returns {Promise<{conditionCategory:string,contraindications:string[],lifestyleFlags:string[]}>}
 */
async function extractConditionContext(rawConditionText) {
  const { system, user } = buildConditionExtractionPrompt(rawConditionText);

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
      throw new RateLimitError('Anthropic rate limit during condition extraction', retryAfterSeconds(err));
    }
    throw new Error(`Condition extraction failed: ${err.message}`);
  }

  const parsed = safeJsonParse(extractText(message)); // throws on bad JSON → caught by controller
  return {
    conditionCategory: clampStr(parsed.conditionCategory, MAX_CATEGORY) || 'unrecognised',
    contraindications: clampList(parsed.contraindications),
    lifestyleFlags: clampList(parsed.lifestyleFlags),
  };
}

module.exports = { extractConditionContext };
