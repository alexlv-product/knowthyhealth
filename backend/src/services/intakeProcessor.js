/**
 * intakeProcessor.js — Claude Call 1 (always fires). Formerly conditionExtractor.
 *
 * PRD v1.4 §7.1: Call 1 is the intake step. From the gender/age spine (plus any
 * optional refinements and a disclosed condition) it identifies the wellness
 * DOMAINS + research topics worth retrieving evidence on for this profile, and,
 * when a condition is disclosed, normalises it to a clinical category with
 * contraindications / lifestyle flags. It is no longer gated on a disclosed
 * condition — condition handling is one branch of intake, not the trigger.
 *
 * The raw healthCondition text enters Claude here and NOWHERE else — it is never
 * sent to Tavily, never returned to the client, and never logged (SAD §7.2). The
 * researchTargets are normalised topics, never the raw condition wording.
 *
 * Throws RateLimitError on a 429 and a generic Error on any other failure. The
 * controller catches BOTH and degrades to intakeContext = null — a Call 1
 * failure never fails the whole request; retrieval falls back to the demographic
 * spine and (if a condition was disclosed) the readout is flagged degraded.
 */

const Anthropic = require('@anthropic-ai/sdk');
const { buildIntakePrompt } = require('../utils/promptBuilder');
const { extractText, safeJsonParse, is429, retryAfterSeconds } = require('../utils/aiHelpers');
const { RateLimitError } = require('../utils/errors');

const MODEL = 'claude-sonnet-4-6'; // Build Handoff MODEL NOTE
const MAX_TOKENS = 1000; // Flag #6
const TIMEOUT_MS = 30_000; // Flag #7

const client = new Anthropic();

const MAX_CATEGORY = 60;
const MAX_ITEM = 80;
const MAX_ITEMS = 5;
const MAX_TARGETS = 8;

function clampStr(v, max) {
  return typeof v === 'string' ? v.slice(0, max) : '';
}
function clampList(v) {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === 'string').slice(0, MAX_ITEMS).map((x) => clampStr(x, MAX_ITEM));
}
function clampTargets(v) {
  if (!Array.isArray(v)) return [];
  return v
    .filter((t) => t && typeof t === 'object')
    .slice(0, MAX_TARGETS)
    .map((t) => ({
      domain: clampStr(t.domain, MAX_ITEM),
      topic: clampStr(t.topic, MAX_ITEM),
    }))
    .filter((t) => t.domain && t.topic);
}

/**
 * @param {object} profile sanitised profile (gender + ageRange required; the
 *   optional refinements and healthCondition may be null)
 * @returns {Promise<{researchTargets:{domain:string,topic:string}[],
 *   conditionCategory:string|null, contraindications:string[], lifestyleFlags:string[]}>}
 */
async function processIntake(profile) {
  const { system, user } = buildIntakePrompt(profile);

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
      throw new RateLimitError('Anthropic rate limit during intake', retryAfterSeconds(err));
    }
    throw new Error(`Intake processing failed: ${err.message}`);
  }

  const parsed = safeJsonParse(extractText(message)); // throws on bad JSON → caught by controller

  const rawCategory = clampStr(parsed.conditionCategory, MAX_CATEGORY);
  const conditionCategory =
    rawCategory && rawCategory.toLowerCase() !== 'unrecognised' && rawCategory.toLowerCase() !== 'null'
      ? rawCategory
      : null;

  return {
    researchTargets: clampTargets(parsed.researchTargets),
    conditionCategory,
    contraindications: clampList(parsed.contraindications),
    lifestyleFlags: clampList(parsed.lifestyleFlags),
  };
}

module.exports = { processIntake };
