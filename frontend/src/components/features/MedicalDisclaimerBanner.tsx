import { SectionLabel } from '../ui';
import { MEDICAL_DISCLAIMER } from '../../constants/disclaimer';

/**
 * MedicalDisclaimerBanner — the persistent, non-dismissible wellness disclaimer.
 *
 * Flag #3 resolved: copy is hardcoded (imported from constants/disclaimer),
 * NOT read from the API response. The API still returns a `disclaimer` field,
 * but this component ignores it by design.
 *
 * Rendered at the bottom of ResultsPanel on every results view (PRD §7.3).
 * No props — there is nothing to configure; that is the point.
 */
export function MedicalDisclaimerBanner() {
  return (
    <div className="mt-2 rounded-lg border-hairline border-stone-200 bg-stone-50 px-5 py-4">
      <SectionLabel variant="muted" className="mb-1.5">
        Disclaimer
      </SectionLabel>
      <p className="text-[13px] leading-[1.6] text-stone-600">
        {MEDICAL_DISCLAIMER}
      </p>
    </div>
  );
}
