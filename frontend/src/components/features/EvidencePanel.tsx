import { useState } from 'react';
import { GradeTile, Pill, SectionLabel } from '../ui';
import { cn } from '../../lib/cn';
import type { AdviceCard, EvidenceSource, CitationType } from '../../types/api';

const CITE_TYPE_VARIANT: Record<CitationType, 'plum' | 'sage' | 'stone' | 'clay'> = {
  Meta: 'plum',
  RCT: 'sage',
  Cohort: 'stone',
  Review: 'clay',
};

interface EvidencePanelProps {
  evidence: EvidenceSource[];
  /** Needed to surface gradeRationale per card for audit visibility. */
  cards: AdviceCard[];
}

/**
 * EvidencePanel (Tier 3) — the full evidence audit, collapsed by default
 * (Build Handoff §2.8).
 *
 * Two sections when expanded:
 *   1. Sources — every EvidenceSource with title, linked URL, domain, date,
 *      and the AI's one-line relevance note.
 *   2. Grade reasoning — the gradeRationale for each card, repeated here for
 *      auditability (Flag #2 resolved: rationale shows in BOTH the badge
 *      tooltip and this panel).
 *
 * Empty state (Tavily failed): a single muted notice, no source list.
 */
export function EvidencePanel({ evidence, cards }: EvidencePanelProps) {
  const [expanded, setExpanded] = useState(false);
  const isEmpty = evidence.length === 0;

  return (
    <section className="overflow-hidden rounded-lg border-hairline border-tier-t3 bg-white shadow-tier-3">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-6 py-4 text-left outline-none transition-colors hover:bg-plum-50 focus-visible:bg-plum-50"
      >
        <span className="flex items-center gap-3">
          <SectionLabel>Evidence</SectionLabel>
          <span className="text-[13px] text-stone-500">
            {isEmpty
              ? 'No sources this session'
              : `${evidence.length} source${evidence.length === 1 ? '' : 's'}`}
          </span>
        </span>
        <span
          aria-hidden="true"
          className={cn(
            'font-mono text-[13px] text-plum-500 transition-transform duration-200',
            expanded && 'rotate-180'
          )}
        >
          ▾
        </span>
      </button>

      {expanded && (
        <div className="border-t border-stone-100 px-6 py-5">
          {isEmpty ? (
            <p className="text-[13px] leading-[1.6] text-stone-500">
              No live research citations are available for this session.
            </p>
          ) : (
            <ol className="flex flex-col gap-4">
              {evidence.map((src, i) => (
                <li key={`${src.url}-${i}`} className="flex gap-3">
                  <span className="mt-0.5 font-mono text-[12px] text-stone-400">
                    [{i + 1}]
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="mb-1 inline-flex">
                      <Pill variant={CITE_TYPE_VARIANT[src.type]} size="sm">
                        {src.type}
                      </Pill>
                    </span>
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[14px] font-medium text-plum-500 underline decoration-plum-200 underline-offset-2 hover:decoration-plum-500"
                    >
                      {src.title}
                    </a>
                    <div className="mt-0.5 font-mono text-[11px] text-stone-500">
                      {src.domain}
                      {src.date && src.date !== 'Unknown' ? ` · ${src.date}` : ''}
                    </div>
                    {src.relevanceNote && (
                      <p className="mt-1 text-[12.5px] leading-[1.55] text-stone-600">
                        {src.relevanceNote}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}

          {/* Grade reasoning audit block */}
          <div className="mt-6 border-t border-stone-100 pt-5">
            <SectionLabel variant="muted" className="mb-3">
              Grade reasoning
            </SectionLabel>
            <ul className="flex flex-col gap-3">
              {cards.map((card, i) => (
                <li key={`${card.headline}-${i}`} className="flex items-start gap-3">
                  <GradeTile grade={card.confidenceGrade} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium leading-[1.4] text-ink">
                      {card.headline}
                    </p>
                    <p className="mt-0.5 text-[12.5px] leading-[1.55] text-stone-600">
                      {card.gradeRationale}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
