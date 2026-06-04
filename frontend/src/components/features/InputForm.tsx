import { useMemo, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  Button,
  Card,
  Chip,
  Input,
  Select,
  SectionLabel,
  SegmentedControl,
  Textarea,
} from '../ui';
import {
  GENDER_OPTIONS,
  AGE_RANGE_OPTIONS,
  DIET_OPTIONS,
  ACTIVITY_OPTIONS,
  SLEEP_OPTIONS,
  SYMPTOM_PRESETS,
  MAX_SYMPTOMS,
  MAX_SYMPTOM_CHARS,
  MAX_CONDITION_CHARS,
} from '../../constants/formOptions';
import { CONDITION_INLINE_WARNING } from '../../constants/disclaimer';
import type {
  FormData,
  Gender,
  AgeRange,
  Diet,
  ActivityLevel,
  SleepQuality,
} from '../../types/api';

interface InputFormProps {
  onSubmit: (formData: FormData) => void;
  /** Pre-fills the form on retry / restored session. */
  initialValues?: FormData | null;
}

const EMPTY_FORM: FormData = {
  gender: undefined,
  ageRange: undefined,
  symptoms: [],
  diet: undefined,
  activityLevel: undefined,
  sleepQuality: undefined,
  healthCondition: '',
};

const isPreset = (s: string) =>
  SYMPTOM_PRESETS.some((p) => p.toLowerCase() === s.toLowerCase());

/**
 * InputForm — the intake form (PRD v1.4 §6).
 *
 * Two visual tiers: a heavier "Required" card (gender + age — the only fields
 * that gate submit, §6.1/§6.3) and a set of optional "Refine the readout" cards.
 * Submit enables as soon as the spine is filled, regardless of the optional
 * state. The form never calls the API directly — App owns the network call and
 * the sessionStorage persistence.
 *
 * Symptoms are an optional lens (§1.2): up to MAX_SYMPTOMS, free-text allowed,
 * and they sharpen the readout rather than structuring it. The health-condition
 * field shows a non-dismissible amber inline warning the moment it has text
 * (§6.4); it is informational and does not block submit.
 */
export function InputForm({ onSubmit, initialValues }: InputFormProps) {
  const [form, setForm] = useState<FormData>(initialValues ?? EMPTY_FORM);
  const [customDraft, setCustomDraft] = useState('');

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const atSymptomCap = form.symptoms.length >= MAX_SYMPTOMS;

  const customSymptoms = useMemo(
    () => form.symptoms.filter((s) => !isPreset(s)),
    [form.symptoms]
  );

  const toggleSymptom = (symptom: string) => {
    setForm((f) => {
      const exists = f.symptoms.some(
        (s) => s.toLowerCase() === symptom.toLowerCase()
      );
      if (exists) {
        return { ...f, symptoms: f.symptoms.filter((s) => s !== symptom) };
      }
      if (f.symptoms.length >= MAX_SYMPTOMS) return f;
      return { ...f, symptoms: [...f.symptoms, symptom] };
    });
  };

  const addCustom = () => {
    const value = customDraft.trim();
    if (!value || value.length > MAX_SYMPTOM_CHARS || atSymptomCap) return;
    const dup = form.symptoms.some((s) => s.toLowerCase() === value.toLowerCase());
    if (dup) {
      setCustomDraft('');
      return;
    }
    set('symptoms', [...form.symptoms, value]);
    setCustomDraft('');
  };

  const onCustomKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustom();
    }
  };

  // Required spine only (§6.3): gender + age range.
  const isComplete = !!form.gender && !!form.ageRange;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isComplete) return;
    onSubmit(form);
  };

  const conditionLen = form.healthCondition.length;

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto w-full max-w-form px-5 pb-16 sm:px-6"
    >
      <header className="mb-7">
        <h1 className="font-serif text-display-sm text-ink">
          See what the research says about you
        </h1>
        <p className="mt-2 text-[14px] leading-[1.6] text-stone-600">
          Your gender and age range decide which evidence applies — they aren't
          cosmetic fields. Everything else is optional and sharpens the readout.
          Nothing is stored; this is a single session.
        </p>
      </header>

      {/* ── Required spine: gender + age ─────────────────────────────────── */}
      <Card variant="required" className="px-6 py-7 sm:px-8">
        <SectionLabel className="mb-4">Required</SectionLabel>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Gender" required>
            <Select
              aria-label="Gender"
              filled={!!form.gender}
              value={form.gender ?? ''}
              onChange={(e) => set('gender', e.target.value as Gender)}
            >
              <option value="" disabled>
                Select…
              </option>
              {GENDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Age range" required>
            <Select
              aria-label="Age range"
              filled={!!form.ageRange}
              value={form.ageRange ?? ''}
              onChange={(e) => set('ageRange', e.target.value as AgeRange)}
            >
              <option value="" disabled>
                Select…
              </option>
              {AGE_RANGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      {/* ── Optional refinements ─────────────────────────────────────────── */}
      <div className="mt-8 mb-4 flex items-center gap-3">
        <SectionLabel variant="muted">Refine the readout</SectionLabel>
        <span className="h-px flex-1 bg-stone-200" aria-hidden="true" />
        <span className="text-[12px] text-stone-500">optional</span>
      </div>

      {/* Lifestyle baseline */}
      <Card className="px-6 py-7 sm:px-8">
        <Field label="Diet pattern">
          <Select
            aria-label="Diet pattern"
            filled={!!form.diet}
            value={form.diet ?? ''}
            onChange={(e) => set('diet', e.target.value as Diet)}
          >
            <option value="">No preference</option>
            {DIET_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>

        <div className="mt-5">
          <Field label="Activity level">
            <SegmentedControl
              ariaLabel="Activity level"
              options={ACTIVITY_OPTIONS}
              value={form.activityLevel}
              onChange={(v) => set('activityLevel', v as ActivityLevel)}
            />
          </Field>
        </div>

        <div className="mt-5">
          <Field label="Sleep quality">
            <SegmentedControl
              ariaLabel="Sleep quality"
              options={SLEEP_OPTIONS}
              value={form.sleepQuality}
              onChange={(v) => set('sleepQuality', v as SleepQuality)}
            />
          </Field>
        </div>
      </Card>

      {/* Concerns */}
      <Card className="mt-5 px-6 py-7 sm:px-8">
        <SectionLabel variant="muted" className="mb-1">
          Concerns
        </SectionLabel>
        <p className="mb-4 text-[13px] text-stone-500">
          Pick up to {MAX_SYMPTOMS}, or add your own. Concerns act as a lens —
          they reweight the readout but don't structure it. ({form.symptoms.length}
          /{MAX_SYMPTOMS})
        </p>

        <div className="flex flex-wrap gap-2">
          {SYMPTOM_PRESETS.map((preset) => {
            const active = form.symptoms.some(
              (s) => s.toLowerCase() === preset.toLowerCase()
            );
            return (
              <Chip
                key={preset}
                active={active}
                disabled={!active && atSymptomCap}
                onClick={() => toggleSymptom(preset)}
                className={
                  !active && atSymptomCap ? 'cursor-not-allowed opacity-40' : undefined
                }
              >
                {preset}
              </Chip>
            );
          })}
        </div>

        {customSymptoms.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {customSymptoms.map((s) => (
              <Chip key={s} variant="custom" onRemove={() => toggleSymptom(s)}>
                {s}
              </Chip>
            ))}
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <Input
            aria-label="Add a custom concern"
            placeholder={atSymptomCap ? 'Maximum reached' : 'Add your own…'}
            maxLength={MAX_SYMPTOM_CHARS}
            disabled={atSymptomCap}
            value={customDraft}
            onChange={(e) => setCustomDraft(e.target.value)}
            onKeyDown={onCustomKeyDown}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={addCustom}
            disabled={atSymptomCap || !customDraft.trim()}
          >
            Add
          </Button>
        </div>
      </Card>

      {/* Health context */}
      <Card className="mt-5 px-6 py-7 sm:px-8">
        <SectionLabel variant="muted" className="mb-1">
          Health context
        </SectionLabel>
        <Field label="Existing health condition">
          <Textarea
            aria-label="Existing health condition"
            rows={3}
            maxLength={MAX_CONDITION_CHARS}
            filled={conditionLen > 0}
            placeholder="e.g. Hashimoto's thyroiditis, on levothyroxine…"
            value={form.healthCondition}
            onChange={(e) => set('healthCondition', e.target.value)}
          />
          <div className="mt-1.5 flex justify-end">
            <span className="font-mono text-[11px] text-stone-500">
              {conditionLen}/{MAX_CONDITION_CHARS}
            </span>
          </div>
        </Field>

        {conditionLen > 0 && (
          <div
            role="note"
            className="mt-3 rounded border-l-4 border-warn-border bg-warn-bg px-4 py-3"
          >
            <p className="text-[12.5px] leading-[1.55] text-warn-text">
              {CONDITION_INLINE_WARNING}
            </p>
          </div>
        )}
      </Card>

      {/* ── Submit ──────────────────────────────────────────────────────── */}
      <Card variant="required" className="mt-8 px-6 py-6 sm:px-8">
        <Button type="submit" size="lg" fullWidth disabled={!isComplete}>
          Get readout →
        </Button>
        {!isComplete && (
          <p className="mt-3 text-center text-[12.5px] text-stone-500">
            Add your gender and age range to continue.
          </p>
        )}
      </Card>
    </form>
  );
}

/** Small labeled-field wrapper. `required` adds a plum asterisk (§6.1). */
function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-stone-700">
        {label}
        {required && <span className="ml-0.5 text-plum-500">*</span>}
      </span>
      {children}
    </label>
  );
}
