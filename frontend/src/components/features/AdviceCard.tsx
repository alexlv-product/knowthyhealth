import { useState } from 'react';
import { GradeTile, Pill, type Grade } from '../ui';
import { cn } from '../../lib/cn';
import type {
  AdviceCard as AdviceCardData,
  Citation,
  CitationType,
} from '../../types/api';

interface AdviceCardProps {
  card: AdviceCardData;
}

type Tier = 1 | 2 | 3;

/** Grade → short evidence label + Pill accent (PRD v1.4 §3.2 meanings). */
const GRADE_META: Record<Grade, { label: string; variant: 'plum' | 'sage' | 'stone' | 'clay' }> = {
  A: { label: 'Strong evidence', variant: 'plum' },
  B: { label: 'Moderate evidence', variant: 'sage' },
  C: { label: 'Mixed evidence', variant: 'stone' },
  D: { label: 'Weak evidence', variant: 'clay' },
  F: { label: 'Unsupported', variant: 'stone' },
};

/** Citation-type pill accent. */
const CITE_TYPE_VARIANT: Record<CitationType, 'plum' | 'sage' | 'stone' | 'clay'> = {
  Meta: 'plum',
  RCT: 'sage',
  Cohort: 'stone',
  Review: 'clay',
};

/** Tier-state outline + glow (§2.4). */
const TIER_BORDER: Record<Tier, string> = {
  1: 'border-hairline border-stone-200',
  2: 'border border-tier-t2',
  3: 'border border-tier-t3 shadow-tier-3',
};

/**
 * AdviceCard — one domain recommendation as a three-tier accordion (§2.1–§2.4).
 *
 * Tiers are depth states of a single card, expanded in place:
 *   T1 (lite)  — domain, grade tile, headline, one-line takeaway, "More ↓"
 *   T2 (more)  — + recommendation, "relevant to you" reasoning, symptom pills,
 *                grade rationale, "Less ↑" / "Evidence →"
 *   T3 (full)  — + mechanism, caveats, full sources with type pills,
 *                "Collapse ↑" (which returns directly to T1, skipping T2)
 *
 * Grade F is never suppressed (§3.3): the noEvidenceCaveat renders as a
 * deep-red-bordered block inside the card. A "contradicted" F may carry the
 * sources that contradict the claim; a "no evidence found" F has none.
 */
export function AdviceCard({ card }: AdviceCardProps) {
  const [tier, setTier] = useState<Tier>(1);
  const meta = GRADE_META[card.confidenceGrade];
  const isF = card.confidenceGrade === 'F';

  return (
    <article className={cn('rounded-lg bg-white px-5 py-5 transition-shadow sm:px-6 sm:py-6', TIER_BORDER[tier])}>
      {/* Tier depth indicator */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-label text-plum-500">
          {card.domain}
        </span>
        <span className="flex items-center gap-2">
          <TierDots tier={tier} />
          <span className="font-mono text-[10px] tracking-meta text-stone-400">
            tier {tier} / 3
          </span>
        </span>
      </div>

      {/* T1 — always visible: grade tile + headline + takeaway */}
      <div className="flex flex-col gap-4 sm:flex-row sm:gap-5">
        <GradeTile grade={card.confidenceGrade} size="lg" className="self-start" />
        <div className="min-w-0 flex-1">
          <div className="mb-2">
            <Pill variant={meta.variant} size="sm">
              {meta.label}
            </Pill>
          </div>
          <h3 className="mb-1.5 font-serif text-[19px] font-medium leading-[1.3] tracking-tight text-ink">
            {card.headline}
          </h3>
          <p className="text-[14px] leading-[1.6] text-stone-700">{card.takeaway}</p>
        </div>
      </div>

      {/* T2 — recommendation + reasoning + symptom relevance + rationale */}
      {tier >= 2 && (
        <div className="mt-5 flex flex-col gap-4 border-t border-stone-100 pt-5">
          <p className="text-[14px] leading-[1.65] text-stone-700">
            {card.recommendation}
          </p>

          {card.reasoning && (
            <div className="rounded border-hairline border-plum-200 bg-plum-50 px-4 py-3">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-label text-plum-500">
                Relevant to you
              </p>
              <p className="text-[13px] leading-[1.6] text-ink">{card.reasoning}</p>
            </div>
          )}

          {card.symptomRelevance.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-stone-500">Addresses:</span>
              {card.symptomRelevance.map((s) => (
                <Pill key={s} variant="stone" size="sm" uppercase={false}>
                  {s}
                </Pill>
              ))}
            </div>
          )}

          <p className="text-[12.5px] leading-[1.55] text-stone-500">
            <span className="font-medium text-stone-600">Why grade {card.confidenceGrade}: </span>
            {card.gradeRationale}
          </p>
        </div>
      )}

      {/* T3 — mechanism + caveats + sources */}
      {tier >= 3 && (
        <div className="mt-4 flex flex-col gap-4 border-t border-stone-100 pt-5">
          {card.mechanism && (
            <Detail label="Mechanism">{card.mechanism}</Detail>
          )}
          {card.caveats && (
            <Detail label="What the evidence doesn't cover">{card.caveats}</Detail>
          )}

          {card.citations.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-label text-stone-500">
                Sources
              </p>
              <ul className="flex flex-col gap-2.5">
                {card.citations.map((c, i) => (
                  <CitationRow key={`${c.url}-${i}`} citation={c} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* F caveat — always shown for grade F, regardless of tier (§3.3) */}
      {isF && (
        <div className="mt-4 rounded border-l-4 border-grade-f bg-[#FBEAEA] px-4 py-3">
          <p className="text-[12.5px] leading-[1.55] text-[#6E1E1E]">
            {card.noEvidenceCaveat ??
              'The available evidence does not support this for people like you. Treat with caution.'}
          </p>
        </div>
      )}

      {/* Depth controls */}
      <div className="mt-4 flex items-center gap-4">
        {tier === 1 && (
          <DepthButton onClick={() => setTier(2)}>More ↓</DepthButton>
        )}
        {tier === 2 && (
          <>
            <DepthButton onClick={() => setTier(1)}>Less ↑</DepthButton>
            <DepthButton onClick={() => setTier(3)}>Evidence →</DepthButton>
          </>
        )}
        {tier === 3 && (
          <DepthButton onClick={() => setTier(1)}>Collapse ↑</DepthButton>
        )}
      </div>
    </article>
  );
}

function TierDots({ tier }: { tier: Tier }) {
  return (
    <span className="flex items-center gap-1" aria-hidden="true">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            n <= tier ? 'bg-plum-500' : 'bg-stone-300'
          )}
        />
      ))}
    </span>
  );
}

function DepthButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded font-mono text-[12px] font-medium text-plum-500 underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-plum-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
    >
      {children}
    </button>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-label text-stone-500">
        {label}
      </p>
      <p className="text-[13px] leading-[1.6] text-stone-700">{children}</p>
    </div>
  );
}

function CitationRow({ citation }: { citation: Citation }) {
  return (
    <li className="flex flex-col gap-0.5">
      <span className="flex items-center gap-2">
        <Pill variant={CITE_TYPE_VARIANT[citation.type]} size="sm">
          {citation.type}
        </Pill>
        <a
          href={citation.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[13px] font-medium text-plum-500 underline decoration-plum-200 underline-offset-2 hover:decoration-plum-500"
        >
          {citation.title}
        </a>
      </span>
      <span className="font-mono text-[11px] text-stone-500">
        {citation.domain}
        {citation.date && citation.date !== 'Unknown' ? ` · ${citation.date}` : ''}
      </span>
    </li>
  );
}
