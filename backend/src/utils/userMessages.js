/**
 * userMessages.js — shared user-facing copy + error code for the retrieval-failure
 * surface. Lives here (neutral util) so both controllers and the recovery-agent
 * templates can use it without coupling the agent-free streaming controller to the
 * recoveryAgent module.
 *
 * Product rule (no all-F readouts): when citation retrieval comes back empty we do
 * NOT compose a hollow, all-F "no evidence found" readout — that misrepresents a
 * retrieval outage as "there is no evidence about you". Instead we retry once and,
 * if still empty, surface a clear alert and stop. The interim message is only shown
 * on the streaming path (a single buffered response can't show an in-progress note).
 */

const RETRIEVAL_UNAVAILABLE = 'RETRIEVAL_UNAVAILABLE';

// Shown the moment retrieval first comes back empty, before the one retry (streaming only).
const RETRIEVAL_INTERIM_MESSAGE =
  "We're having trouble accessing the sources. We'll try again and let you know the outcome.";

// Terminal: the retry also failed. We deliberately do not show partial/ungrounded results.
const RETRIEVAL_TERMINAL_MESSAGE =
  "The service that retrieves the sources isn't responding. We won't show you incomplete " +
  "results — we'll wait for it to come back up before searching again.";

module.exports = {
  RETRIEVAL_UNAVAILABLE,
  RETRIEVAL_INTERIM_MESSAGE,
  RETRIEVAL_TERMINAL_MESSAGE,
};
