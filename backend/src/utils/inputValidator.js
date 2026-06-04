/**
 * inputValidator.js — SAD §3.2.3, authoritative rules in API Design §6.
 *
 * Validates and sanitises the incoming request body. The backend treats the
 * body as fully untrusted; client-side validation is a UX convenience only.
 *
 * On any failure this throws a ValidationError, which the controller maps to a
 * 400 VALIDATION_ERROR. On success it returns a new, sanitised body object.
 */

const { ValidationError } = require('./errors');

// Re-export so callers that expect ValidationError from this module (per the
// SAD/Build Handoff) keep working.
module.exports.ValidationError = ValidationError;

// ── Allowlists (API Design §2.4 / §6) ───────────────────────────────────────
const GENDER = ['male', 'female', 'non-binary', 'prefer-not-to-say'];
const AGE_RANGE = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
const DIET = ['omnivore', 'vegetarian', 'vegan', 'keto', 'mediterranean', 'other'];
const ACTIVITY = ['sedentary', 'light', 'moderate', 'active', 'very-active'];
const SLEEP = ['poor', 'fair', 'good', 'excellent'];

const MAX_SYMPTOMS = 6;
const MAX_SYMPTOM_CHARS = 100;
const MAX_CONDITION_CHARS = 300;

/**
 * Prompt-injection patterns (Build Handoff Flag #11). Best-effort defence, NOT
 * a security boundary — any value that passes is still treated as untrusted
 * data when injected into a prompt.
 */
const INJECTION_PATTERNS = [
  'ignore previous',
  'ignore all',
  'you are now',
  'as an ai',
  'forget your instructions',
  'new instructions',
  'system prompt',
  'disregard',
  'override',
];

/**
 * Strip HTML tags, <script> blocks, JS event-handler attributes, and control
 * characters (except \n and \t), then trim. Applied to every string field.
 */
function sanitiseString(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, '') // script blocks (with content)
    .replace(/<[^>]*>/g, '') // any remaining HTML tags
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '') // on*= handlers
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // control chars, keep \t(09) \n(0A)
    .trim();
}

function requireEnum(value, allowlist, field, { lower = true } = {}) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ValidationError(`${field} is required`);
  }
  const normalised = lower ? value.trim().toLowerCase() : value.trim();
  if (!allowlist.includes(normalised)) {
    throw new ValidationError(`${field} is not a recognised value`);
  }
  return normalised;
}

/**
 * Optional enum (PRD v1.4 §1.2 / §6.1): absent/null/empty → null (the field was
 * not provided). When a value IS provided it must still be in the allowlist —
 * an unrecognised value is a hard 400, not a silent drop.
 */
function optionalEnum(value, allowlist, field, { lower = true } = {}) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const normalised = lower ? value.trim().toLowerCase() : value.trim();
  if (!allowlist.includes(normalised)) {
    throw new ValidationError(`${field} is not a recognised value`);
  }
  return normalised;
}

/**
 * @param {unknown} body raw request body
 * @returns {object} sanitised, validated body
 * @throws {ValidationError}
 */
function validateInput(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ValidationError('Request body must be a JSON object');
  }

  // Required spine (PRD v1.4 §1.2): gender + ageRange only.
  const gender = requireEnum(body.gender, GENDER, 'gender');
  const ageRange = requireEnum(body.ageRange, AGE_RANGE, 'ageRange', { lower: false });

  // Optional refinements: enum-checked when present, else null.
  const diet = optionalEnum(body.diet, DIET, 'diet');
  const activityLevel = optionalEnum(body.activityLevel, ACTIVITY, 'activityLevel');
  const sleepQuality = optionalEnum(body.sleepQuality, SLEEP, 'sleepQuality');

  // symptoms — OPTIONAL lens (PRD v1.4 §1.2). 0–6 items, each ≤100 chars after
  // sanitising. Absent/null/empty array all collapse to []. Still hard-reject
  // a non-array or an over-cap list (those signal a malformed client).
  let symptoms = [];
  if (body.symptoms !== undefined && body.symptoms !== null) {
    if (!Array.isArray(body.symptoms)) {
      throw new ValidationError('symptoms must be an array');
    }
    symptoms = body.symptoms.map((s) => sanitiseString(s)).filter((s) => s.length > 0);
    if (symptoms.length > MAX_SYMPTOMS) {
      throw new ValidationError('symptoms must contain at most 6 items');
    }
    if (symptoms.some((s) => s.length > MAX_SYMPTOM_CHARS)) {
      throw new ValidationError('each symptom must be 1 to 100 characters');
    }
  }

  // healthCondition — optional; reject (never truncate) if too long or injection
  let healthCondition = null;
  if (body.healthCondition !== undefined && body.healthCondition !== null) {
    if (typeof body.healthCondition !== 'string') {
      throw new ValidationError('healthCondition must be a string');
    }
    const cleaned = sanitiseString(body.healthCondition);
    if (cleaned.length > 0) {
      if (cleaned.length > MAX_CONDITION_CHARS) {
        throw new ValidationError('healthCondition must be under 300 characters');
      }
      const lc = cleaned.toLowerCase();
      if (INJECTION_PATTERNS.some((p) => lc.includes(p))) {
        throw new ValidationError(
          'healthCondition contains phrases that could not be processed; please rephrase'
        );
      }
      healthCondition = cleaned;
    }
  }

  return { gender, ageRange, symptoms, diet, activityLevel, sleepQuality, healthCondition };
}

module.exports.validateInput = validateInput;
module.exports.INJECTION_PATTERNS = INJECTION_PATTERNS;
module.exports.sanitiseString = sanitiseString;
