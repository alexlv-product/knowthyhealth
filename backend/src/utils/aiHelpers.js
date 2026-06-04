/**
 * Small helpers shared by the two Claude-calling services.
 */

/** Pull the first text block out of an Anthropic Messages response. */
function extractText(message) {
  if (!message || !Array.isArray(message.content)) return '';
  const block = message.content.find((b) => b.type === 'text') || message.content[0];
  return (block && block.text) || '';
}

/**
 * Parse model JSON. The prompts forbid markdown fences, but we strip them
 * defensively anyway so a stray ```json wrapper can't fail the whole request.
 * Throws if the result is still not valid JSON.
 */
function safeJsonParse(text) {
  const cleaned = String(text)
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  return JSON.parse(cleaned);
}

/** True when an SDK/HTTP error represents an upstream rate limit. */
function is429(err) {
  return Boolean(err && (err.status === 429 || err.statusCode === 429));
}

/** Best-effort Retry-After (seconds) from an SDK error's headers. */
function retryAfterSeconds(err) {
  try {
    const h = err && err.headers;
    const raw = h && (typeof h.get === 'function' ? h.get('retry-after') : h['retry-after']);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

module.exports = { extractText, safeJsonParse, is429, retryAfterSeconds };
