/**
 * Static legal/safety copy.
 *
 * Build-Time Flag #3 resolved: the medical disclaimer is hardcoded here rather
 * than read from the API `disclaimer` field. Hardcoding removes one runtime
 * dependency from a non-negotiable, non-dismissible element — if the API ever
 * omits or mangles the field, the disclaimer still renders correctly.
 *
 * The exact strings are lifted verbatim from PRD §7.3 and §7.4.
 */

/** Persistent, non-dismissible medical disclaimer (PRD §7.3). */
export const MEDICAL_DISCLAIMER =
  'This information is provided for general wellness and educational purposes ' +
  'only. It does not constitute medical advice, diagnosis, or treatment. Always ' +
  'consult a qualified healthcare professional before making changes to your ' +
  'diet, exercise routine, or health management.';

/** Inline notice shown while the health-condition field has any text (PRD §7.4.A). */
export const CONDITION_INLINE_WARNING =
  'If you have an existing health condition, please review all recommendations ' +
  'from this tool with your doctor before making any changes to your health ' +
  'routine.';

/**
 * Fallback for the output ConditionWarningBanner. The banner normally renders
 * the AI-generated `conditionWarning` verbatim; this is used only if that field
 * is unexpectedly empty while a condition was disclosed.
 */
export const CONDITION_BANNER_FALLBACK =
  'You have disclosed a health condition. These recommendations are for general ' +
  'wellness education only and do not account for your specific diagnosis, ' +
  'medications, or treatment plan. Please review all advice with a qualified ' +
  'healthcare provider.';
