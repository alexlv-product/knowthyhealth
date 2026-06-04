import { SectionLabel } from '../ui';

interface SummarySectionProps {
  summary: string;
}

/**
 * SummarySection (Tier 2) — the single integrative narrative paragraph.
 *
 * Renders `summary` verbatim as plain text. No markdown parsing (Build Handoff
 * §2.7) — the backend sends a finished paragraph, and treating it as plain text
 * is both safer (no injected markup) and matches the spec.
 *
 * Set in serif to read as prose and to contrast with the data-dense cards above.
 */
export function SummarySection({ summary }: SummarySectionProps) {
  return (
    <section className="rounded-lg border-hairline border-tier-t2 bg-white px-6 py-6 shadow-none">
      <SectionLabel className="mb-3">In summary</SectionLabel>
      <p className="whitespace-pre-line font-serif text-[16px] leading-[1.7] text-ink">
        {summary}
      </p>
    </section>
  );
}
