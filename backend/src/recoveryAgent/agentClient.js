/**
 * agentClient.js — the model-directed classification + action choice (Day 2).
 *
 * A single non-streaming Anthropic call (Haiku-class) with a `tools` parameter and
 * `tool_choice: {type:'any', disable_parallel_tool_use:true}`, forcing the model to
 * emit EXACTLY ONE tool call. Which tool it picks IS the recovery action; the tool's
 * arguments carry the root-cause `classification` and a short `reasoning`. The action
 * allowlist is enforced in CODE (the tool set here + actions.isAllowed), never in the
 * prompt — the model cannot invent an action.
 *
 * RECURSION GUARD: this is the one place the agent talks to a provider. It is NEVER
 * routed back through escalate() — a 429/timeout/any failure rejects, and the caller
 * (escalate) collapses to the static floor. The agent never handles its own errors.
 *
 * PRIVACY: only the privacy-safe context from contextAssembler is sent — error
 * class/message, trimmed stack, route, stage, payload SHAPE (types, never values),
 * retry count, provider metadata. No field values, no PII.
 */

const Anthropic = require('@anthropic-ai/sdk');

const MODEL = 'claude-haiku-4-5'; // fast/cheap classification (PRD)
const MAX_TOKENS = 1024;
const TIMEOUT_MS = 2800; // under the 3s agent budget; escalate() also races it

// Root-cause labels the agent must choose from (PRD §Diagnosis).
const CLASSIFICATIONS = [
  'transient_provider_failure',
  'rate_limit',
  'malformed_model_output',
  'legitimate_empty_state',
  'configuration_defect',
  'unknown',
];

// Degradation modes the pipeline supports — the only ones activate_fallback may
// request. Retrieval failures are handled deterministically in the controllers
// (retry once → alert), NOT degraded to an all-F readout, so the only remaining
// fallback mode is the intake one (which still yields a real, cited readout).
const FALLBACK_MODES = ['proceed_without_intake_context'];

const classificationProp = {
  type: 'string',
  enum: CLASSIFICATIONS,
  description: 'The single best root-cause label for this error.',
};
const reasoningProp = {
  type: 'string',
  description:
    'One or two sentences justifying the classification and chosen action. ' +
    'Describe the failure only — never restate user/field values.',
};

// The action allowlist, AS TOOLS. The model picks exactly one; the name is the action.
const TOOLS = [
  {
    name: 'retry_request',
    description:
      'Re-execute the failed pipeline call once with backoff. ONLY for transient ' +
      'provider failures or rate limits that are likely to succeed on a retry. ' +
      'Max one retry cycle per request.',
    input_schema: {
      type: 'object',
      properties: { classification: classificationProp, reasoning: reasoningProp },
      required: ['classification', 'reasoning'],
      additionalProperties: false,
    },
  },
  {
    name: 'activate_fallback',
    description:
      'Continue the pipeline in a pre-defined degraded mode. Use when an UPSTREAM ' +
      'stage failed but a degraded readout is still meaningful. Never fabricates ' +
      'content; only the listed modes are permitted.',
    input_schema: {
      type: 'object',
      properties: {
        classification: classificationProp,
        reasoning: reasoningProp,
        mode: {
          type: 'string',
          enum: FALLBACK_MODES,
          description:
            'proceed_without_intake_context: intake failed, continue on the demographic ' +
            'spine (still produces a real, cited readout).',
        },
      },
      required: ['classification', 'reasoning', 'mode'],
      additionalProperties: false,
    },
  },
  {
    name: 'fail_gracefully',
    description:
      'Abort with a plain-language, stage-specific explanation for the user. The ' +
      'mandatory floor — always available. Use when retry is unlikely to help and no ' +
      'degraded continuation is meaningful (e.g. malformed model output, a hard ' +
      'readout failure, or an unknown error).',
    input_schema: {
      type: 'object',
      properties: { classification: classificationProp, reasoning: reasoningProp },
      required: ['classification', 'reasoning'],
      additionalProperties: false,
    },
  },
];

const SYSTEM_PROMPT = [
  'You are the error-recovery classifier for the KnowThyHealth advice API — a',
  'stateless pipeline: validate → intake (Claude Call 1) → citation retrieval (Tavily)',
  '→ readout (Claude Call 2). A runtime error was intercepted. From the privacy-safe',
  'error context you are given, identify the root cause and choose exactly ONE recovery',
  'action by calling exactly one tool.',
  '',
  'You handle intake and readout failures only. (Citation-retrieval failures are',
  'handled deterministically elsewhere — retry then alert — so you will not see them.)',
  '',
  'Guidance:',
  '- retry_request only when the failure is transient/rate-limit and a single retry is',
  '  plausibly sufficient.',
  '- activate_fallback only for an intake failure where continuing on the demographic',
  '  spine still yields a real, cited readout (mode proceed_without_intake_context). A',
  '  failed readout has no content to degrade to — do not use activate_fallback for it.',
  '- fail_gracefully for malformed model output, hard readout failures, configuration',
  '  defects, or anything unknown.',
  '',
  'You only ever see error metadata and shapes — never user data. Keep reasoning to one',
  'or two sentences and never echo field values.',
].join('\n');

/** Build the user message: the privacy-safe context, verbatim. */
function buildUserContent(context) {
  return `Intercepted error context (privacy-safe):\n${JSON.stringify(context, null, 2)}`;
}

/** Pull the single tool_use block out of a Messages response, or null. */
function extractToolUse(message) {
  if (!message || !Array.isArray(message.content)) return null;
  return message.content.find((b) => b && b.type === 'tool_use') || null;
}

// Lazy singleton — constructing at module load would throw without an API key even on
// the happy path; deferring keeps require() side-effect-free and testable.
let _client = null;
function getClient() {
  if (!_client) _client = new Anthropic();
  return _client;
}

/**
 * Ask the agent to classify the error and choose one allowlisted action.
 *
 * @param {object} context privacy-safe context from assembleContext
 * @param {object} [ctx] { signal? } optional abort signal
 * @returns {Promise<{action:string, classification:string, reasoning:string, params:object}>}
 * @throws on any API failure, a missing tool_use, or a disallowed action name
 */
async function classifyAndDecide(context, ctx = {}) {
  const message = await getClient().messages.create(
    {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserContent(context) }],
      tools: TOOLS,
      tool_choice: { type: 'any', disable_parallel_tool_use: true },
    },
    { timeout: TIMEOUT_MS, maxRetries: 0, signal: ctx.signal }
  );

  const toolUse = extractToolUse(message);
  if (!toolUse) throw new Error('agent returned no tool_use block');
  if (!TOOLS.some((t) => t.name === toolUse.name)) {
    throw new Error(`agent selected a non-allowlisted action: ${toolUse.name}`);
  }

  const input = toolUse.input && typeof toolUse.input === 'object' ? toolUse.input : {};
  const { classification, reasoning, ...params } = input;
  return {
    action: toolUse.name,
    classification: typeof classification === 'string' ? classification : 'unknown',
    reasoning: typeof reasoning === 'string' ? reasoning : '',
    params,
  };
}

module.exports = { classifyAndDecide, MODEL, TOOLS, SYSTEM_PROMPT, CLASSIFICATIONS, FALLBACK_MODES, buildUserContent };
