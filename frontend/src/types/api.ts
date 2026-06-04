/**
 * API contract types — the single source of truth for the shapes that cross
 * the browser ↔ backend boundary.
 *
 * Updated for PRD v1.4: gender + age are the required spine, every other intake
 * field is optional (§1.2); the response is domain-grouped cards of variable
 * count (§1.1), each carrying T1/T2/T3 content (§2.3) and citation-type pills;
 * the A–F grade ramp is unchanged in letters but F now means contradicted/
 * unsupported (§3.2); errors carry an opaque supportReference (§5.2).
 *
 * Hand-written on purpose: the contract is small, and the literal unions double
 * as the form's allowlists.
 */

import type { Grade } from '../components/ui/GradeTile';

export type { Grade };

// ── Request enums (also used by the form's option lists) ─────────────────────
export type Gender = 'male' | 'female' | 'non-binary' | 'prefer-not-to-say';
export type AgeRange = '18-24' | '25-34' | '35-44' | '45-54' | '55-64' | '65+';
export type Diet =
  | 'omnivore'
  | 'vegetarian'
  | 'vegan'
  | 'keto'
  | 'mediterranean'
  | 'other';
export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very-active';
export type SleepQuality = 'poor' | 'fair' | 'good' | 'excellent';

/**
 * The exact JSON body POSTed to /api/v1/advice. Required spine = gender +
 * ageRange (§1.2/§6.1); everything else is an optional refinement and is simply
 * omitted when not provided.
 */
export interface AdviceRequest {
  gender: Gender;
  ageRange: AgeRange;
  symptoms?: string[]; // optional lens, 0–6 items, each ≤100 chars
  diet?: Diet;
  activityLevel?: ActivityLevel;
  sleepQuality?: SleepQuality;
  healthCondition?: string | null; // optional, ≤300 chars
}

/** Form state mirrors the request but allows "not yet chosen" (undefined). */
export interface FormData {
  gender?: Gender;
  ageRange?: AgeRange;
  symptoms: string[];
  diet?: Diet;
  activityLevel?: ActivityLevel;
  sleepQuality?: SleepQuality;
  healthCondition: string;
}

// ── Success response — the "readout" ─────────────────────────────────────────

/** Tier-3 citation-type pill (§2.3). */
export type CitationType = 'Meta' | 'RCT' | 'Cohort' | 'Review';

export interface Citation {
  title: string;
  url: string; // validated against the Tavily result set server-side
  date: string; // ISO date or "Unknown"
  domain: string;
  type: CitationType;
}

/**
 * A recommendation unit, grouped by wellness DOMAIN (§1.1). `domain` is a
 * free-form label; the UI groups cards that share one. Each card carries all
 * three tier states (§2.3): T1 = headline + takeaway; T2 = + recommendation,
 * reasoning, symptomRelevance; T3 = + mechanism, caveats, citations.
 */
export interface AdviceCard {
  domain: string;
  headline: string;
  takeaway: string;
  recommendation: string;
  reasoning: string;
  symptomRelevance: string[]; // [] when no symptoms were submitted
  mechanism: string;
  caveats: string;
  citations: Citation[]; // [] for grade F "no evidence found"
  confidenceGrade: Grade; // F = contradicted/unsupported (§3.2)
  gradeRationale: string;
  noEvidenceCaveat: string | null; // non-null for grade F
}

export interface EvidenceSource {
  title: string;
  url: string;
  domain: string;
  date: string;
  relevanceNote: string;
  type: CitationType;
}

export interface AdviceResponse {
  cards: AdviceCard[]; // domain-grouped, variable count
  summary: string;
  evidence: EvidenceSource[];
  disclaimer: string;
  conditionWarning: string | null;
}

// ── Error envelope (§2.6 + v1.4 §5.2) ────────────────────────────────────────
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'ADVICE_GENERATION_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'INTERNAL_ERROR'
  | 'NETWORK_ERROR'; // client-only: fetch rejected (CORS, offline, timeout)

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  /** Present only for RATE_LIMIT_ERROR when a Retry-After was forwarded. */
  retryAfterSeconds?: number | null;
  /** Opaque support code (e.g. "8h2k3m"); the only diagnostic shown to users. */
  supportReference?: string | null;
}

export type AppState = 'landing' | 'idle' | 'loading' | 'results' | 'error';
