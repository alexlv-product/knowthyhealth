/**
 * Form option lists — the value/label pairs for every select-style field.
 *
 * Values are the exact enum strings the backend allowlist accepts
 * (API Design §6); labels are what the user reads. Keeping both here means
 * InputForm never hard-codes a string and the backend contract has one
 * front-end mirror.
 */

import type {
  Gender,
  AgeRange,
  Diet,
  ActivityLevel,
  SleepQuality,
} from '../types/api';

export interface Option<T extends string> {
  value: T;
  label: string;
}

export const GENDER_OPTIONS: Option<Gender>[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non-binary', label: 'Non-binary' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
];

export const AGE_RANGE_OPTIONS: Option<AgeRange>[] = [
  { value: '18-24', label: '18–24' },
  { value: '25-34', label: '25–34' },
  { value: '35-44', label: '35–44' },
  { value: '45-54', label: '45–54' },
  { value: '55-64', label: '55–64' },
  { value: '65+', label: '65+' },
];

export const DIET_OPTIONS: Option<Diet>[] = [
  { value: 'omnivore', label: 'Omnivore' },
  { value: 'mediterranean', label: 'Mediterranean' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'keto', label: 'Keto / Low-carb' },
  { value: 'other', label: 'Other / Unknown' },
];

// Ordered scale → rendered as a SegmentedControl
export const ACTIVITY_OPTIONS: Option<ActivityLevel>[] = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'light', label: 'Light' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'active', label: 'Active' },
  { value: 'very-active', label: 'Very active' },
];

// Ordered scale → rendered as a SegmentedControl
export const SLEEP_OPTIONS: Option<SleepQuality>[] = [
  { value: 'poor', label: 'Poor' },
  { value: 'fair', label: 'Fair' },
  { value: 'good', label: 'Good' },
  { value: 'excellent', label: 'Excellent' },
];

/** Curated symptom presets (PRD §7.1). Free-text additions allowed on top. */
export const SYMPTOM_PRESETS: string[] = [
  'Fatigue',
  'Sleep issues',
  'Joint pain',
  'Digestive issues',
  'Anxiety',
  'Headaches',
  'Weight management',
  'Skin concerns',
];

// Field limits (UX-side mirror of the server-authoritative rules)
export const MAX_SYMPTOMS = 6;
export const MAX_SYMPTOM_CHARS = 100;
export const MAX_CONDITION_CHARS = 300;
