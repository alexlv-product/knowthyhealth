import { AdviceCard } from './AdviceCard';
import type { AdviceCard as AdviceCardData, EvidenceSource } from '../../types/api';

interface AdviceCardGridProps {
  cards: AdviceCardData[];
  /** Used to detect the Tavily-degraded state (all-F cards + empty evidence). */
  evidence: EvidenceSource[];
}

/** Group cards by domain, preserving first-seen order (PRD v1.4 §1.1). */
function groupByDomain(cards: AdviceCardData[]): { domain: string; cards: AdviceCardData[] }[] {
  const order: string[] = [];
  const map = new Map<string, AdviceCardData[]>();
  for (const card of cards) {
    const key = card.domain || 'Other';
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(card);
  }
  return order.map((domain) => ({ domain, cards: map.get(domain)! }));
}

/**
 * AdviceCardGrid — renders the readout as domain groups, each holding its 1–3
 * cards. Domains are variable per response (§1.4); the grouping is purely the
 * cards' shared `domain` label.
 *
 * Tavily-degraded (ERR-08 / §5.1): the backend returns all-grade-F cards with an
 * empty evidence array. We surface an amber banner clarifying the citations
 * couldn't be verified — distinct from "the evidence contradicts this."
 */
export function AdviceCardGrid({ cards, evidence }: AdviceCardGridProps) {
  const tavilyDegraded =
    cards.length > 0 &&
    cards.every((c) => c.confidenceGrade === 'F') &&
    evidence.length === 0;

  const groups = groupByDomain(cards);

  return (
    <div className="flex flex-col gap-7">
      {tavilyDegraded && (
        <div
          role="status"
          className="rounded-lg border-l-4 border-warn-border bg-warn-bg px-5 py-3.5"
        >
          <p className="text-[13px] leading-[1.55] text-warn-text">
            We couldn't verify live citations this session, so every finding is
            graded F. This means sources are temporarily unavailable — not that
            the evidence contradicts these recommendations.
          </p>
        </div>
      )}

      {groups.map((group) => (
        <section key={group.domain} className="flex flex-col gap-4">
          {groups.length > 1 && (
            <h2 className="font-serif text-[15px] font-medium text-stone-600">
              {group.domain}
            </h2>
          )}
          {group.cards.map((card, i) => (
            <AdviceCard key={`${group.domain}-${card.headline}-${i}`} card={card} />
          ))}
        </section>
      ))}
    </div>
  );
}
