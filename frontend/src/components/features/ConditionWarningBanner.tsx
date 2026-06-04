import { CONDITION_BANNER_FALLBACK } from '../../constants/disclaimer';

interface ConditionWarningBannerProps {
  /** AI-generated doctor-review language. Rendered verbatim. */
  conditionWarning: string;
}

/**
 * ConditionWarningBanner — the red, non-dismissible doctor-review banner shown
 * at the very top of the results panel whenever a health condition was
 * disclosed (PRD §7.4.C, Build Handoff §2.10).
 *
 * The text is AI-generated (Claude Call 2's `conditionWarning`) and rendered
 * verbatim — including the appended degraded-mode note when condition
 * extraction failed. We only substitute a static fallback in the unlikely case
 * the field arrives empty.
 *
 * Uses the `danger` token family (red) to distinguish it from the softer amber
 * inline notice the form shows during typing.
 */
export function ConditionWarningBanner({
  conditionWarning,
}: ConditionWarningBannerProps) {
  const text = conditionWarning?.trim() || CONDITION_BANNER_FALLBACK;

  return (
    <div
      role="alert"
      className="rounded-lg border-l-4 border-danger-border bg-danger-bg px-5 py-4"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-px font-serif text-[18px] leading-none text-danger-textBold"
        >
          ⚕
        </span>
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-label text-danger-textBold">
            Review with your doctor
          </p>
          <p className="text-[13px] leading-[1.6] text-danger-text">{text}</p>
        </div>
      </div>
    </div>
  );
}
