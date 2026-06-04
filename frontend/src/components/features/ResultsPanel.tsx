import { Button, SectionLabel } from '../ui';
import { ConditionWarningBanner } from './ConditionWarningBanner';
import { AdviceCardGrid } from './AdviceCardGrid';
import { SummarySection } from './SummarySection';
import { EvidencePanel } from './EvidencePanel';
import { MedicalDisclaimerBanner } from './MedicalDisclaimerBanner';
import type { AdviceResponse } from '../../types/api';

interface ResultsPanelProps {
  responseData: AdviceResponse;
  /** Resets the app back to the idle form. */
  onReset: () => void;
}

/**
 * ResultsPanel — the results container. Renders children in a FIXED order
 * (Build Handoff §2.4):
 *
 *   ConditionWarningBanner (only if conditionWarning !== null)
 *   → AdviceCardGrid
 *   → SummarySection
 *   → EvidencePanel
 *   → MedicalDisclaimerBanner  (always)
 *
 * The MedicalDisclaimerBanner renders unconditionally; nothing in the response
 * can suppress it.
 */
export function ResultsPanel({ responseData, onReset }: ResultsPanelProps) {
  const { cards, summary, evidence, conditionWarning } = responseData;

  return (
    <div className="mx-auto w-full max-w-wide px-5 pb-16 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <SectionLabel>Your readout</SectionLabel>
        <Button variant="secondary" size="sm" onClick={onReset}>
          Start over
        </Button>
      </div>

      <div className="flex flex-col gap-5">
        {conditionWarning !== null && (
          <ConditionWarningBanner conditionWarning={conditionWarning} />
        )}

        <AdviceCardGrid cards={cards} evidence={evidence} />

        <SummarySection summary={summary} />

        <EvidencePanel evidence={evidence} cards={cards} />

        <MedicalDisclaimerBanner />
      </div>
    </div>
  );
}
