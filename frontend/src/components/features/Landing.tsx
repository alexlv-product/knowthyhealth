import { useEffect, useState } from 'react';
import { Button, GradeTile, Pill, type Grade } from '../ui';
import { AdviceCard } from './AdviceCard';
import { cn } from '../../lib/cn';
import type { AdviceCard as AdviceCardData } from '../../types/api';

interface LandingProps {
  /** Advance into the intake form (App: 'landing' → 'idle'). */
  onStart: () => void;
}

/* ── Hero copy (PRD v1.4 §4.2–4.4) ──────────────────────────────────────────
 * Locked wording. "thy" appears only in the brand mark; body voice is "you".
 */
const HERO_SUBHEAD =
  'Studies are designed around a defined population; that\u2019s how variables get ' +
  'controlled and findings get isolated. The breakdown is downstream \u2014 those ' +
  'findings get extrapolated by media, the wellness industry, and even medical ' +
  'professionals, to people who resemble nothing of the study subjects. ' +
  'KnowThyHealth surfaces the research done on people like you \u2014 your gender, ' +
  'your age \u2014 and grades each finding by the strength of its evidence, so you ' +
  'get the information you actually need.';

/* ── Grade-ramp legend (§3.1 saturated ramp + §3.2 meanings) ──────────────── */
const GRADE_LEGEND: { grade: Grade; label: string }[] = [
  { grade: 'A', label: 'Strong' },
  { grade: 'B', label: 'Moderate' },
  { grade: 'C', label: 'Mixed' },
  { grade: 'D', label: 'Weak' },
  { grade: 'F', label: 'Unsupported' },
];

/* ── Sample readout (§4.4 "what you might expect") ──────────────────────────
 * Illustrative content for a woman, 35–44. The cards are the REAL AdviceCard
 * component with static data, so the preview behaves exactly like a live
 * readout (tier accordion and all). Citations link only to publisher roots —
 * never fabricated article URLs — and the whole section is labelled "Example".
 */
const SAMPLE_CARDS: AdviceCardData[] = [
  {
    domain: 'Nutrition',
    headline: 'Spread protein across your meals, not just dinner',
    takeaway:
      'For women in your age range, even protein distribution supports muscle maintenance better than one large evening serving.',
    recommendation:
      'Aim for a protein source at breakfast and lunch, not only at dinner — roughly 25–30g per meal.',
    reasoning:
      'Trials in women 30–50 consistently show muscle protein synthesis responds to per-meal dose, and most people in this group under-eat protein earlier in the day.',
    symptomRelevance: [],
    mechanism:
      'Each meal triggers a discrete muscle-protein-synthesis response that plateaus past a threshold dose, so the same daily total does more work when spread out.',
    caveats:
      'Total daily intake still matters most; redistribution is a refinement, not a replacement for adequate overall protein.',
    citations: [
      {
        title: 'Per-meal protein distribution and muscle synthesis (review)',
        url: 'https://pubmed.ncbi.nlm.nih.gov/',
        date: '2022',
        domain: 'pubmed.ncbi.nlm.nih.gov',
        type: 'Meta',
      },
    ],
    confidenceGrade: 'A',
    gradeRationale:
      'Multiple controlled trials and a meta-analysis, several conducted specifically in adult women, point the same direction.',
    noEvidenceCaveat: null,
  },
  {
    domain: 'Sleep',
    headline: 'Get morning light to anchor your sleep timing',
    takeaway:
      'Bright light within an hour of waking tends to advance and stabilize the body clock — a common weak point in this demographic.',
    recommendation:
      'Get 10–20 minutes of outdoor light in the morning, ideally before screens.',
    reasoning:
      'Cohort and intervention data in adults show morning light exposure correlates with earlier, more consistent sleep onset; effects are well-documented but vary by individual.',
    symptomRelevance: [],
    mechanism:
      'Morning light suppresses residual melatonin and phase-advances the circadian pacemaker, shifting sleepiness earlier in the evening.',
    caveats:
      'Most studies are short-term; long-term adherence effects in free-living adults are less certain.',
    citations: [
      {
        title: 'Morning light exposure and circadian phase in adults',
        url: 'https://www.nih.gov/',
        date: '2021',
        domain: 'nih.gov',
        type: 'Cohort',
      },
    ],
    confidenceGrade: 'B',
    gradeRationale:
      'Consistent direction across cohort and small intervention studies, but limited long-term and demographic-specific data.',
    noEvidenceCaveat: null,
  },
  {
    domain: 'Supplements',
    headline: 'Routine antioxidant megadoses are not supported for you',
    takeaway:
      'High-dose antioxidant supplements have not shown the protective benefit they are marketed for, and some trials found harm.',
    recommendation:
      'There is no evidence-based reason to take high-dose antioxidant supplements for general prevention in your profile.',
    reasoning:
      'Large randomized trials, including ones with substantial female enrollment, found no benefit for general prevention — and a few signaled increased risk at high doses.',
    symptomRelevance: [],
    mechanism:
      'Disrupting normal redox signaling with megadoses appears to blunt some of the body’s own adaptive responses rather than help.',
    caveats:
      'This concerns high-dose supplementation for prevention, not antioxidants obtained from a normal diet.',
    citations: [
      {
        title: 'High-dose antioxidant supplements for prevention (randomized trials)',
        url: 'https://www.health.harvard.edu/',
        date: '2020',
        domain: 'health.harvard.edu',
        type: 'RCT',
      },
    ],
    confidenceGrade: 'F',
    gradeRationale:
      'The weight of randomized evidence contradicts the marketed benefit, with some signals of harm at high doses.',
    noEvidenceCaveat:
      'This is an F because the evidence contradicts the claim — not because evidence is missing. Findings like this are shown, never hidden.',
  },
];

function scrollToSample() {
  document.getElementById('sample')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Landing — the entry surface a first-time visitor (or a recruiter following a
 * portfolio link) sees before the intake form. Three movements:
 *
 *   1. Hero        — the thesis, the subhead, and the two CTAs (§4.2–4.3).
 *   2. Sample      — a real, interactive readout so "what you might expect"
 *                    is shown, not described (§4.4).
 *   3. Closing CTA — the footer headline + a final "Try it on yourself" (§4.4).
 *
 * Hero sits in the 640px page measure; the sample widens to the 880px results
 * measure so the cards read the way they will in a live readout (§8.1).
 */
export function Landing({ onStart }: LandingProps) {
  // Lightweight mounted reveal — no Tailwind-config keyframe needed.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="flex flex-col">
      {/* ── 1. HERO ───────────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-[46rem] px-5 pb-4 pt-6 sm:px-6 sm:pt-10">
        <div
          className={cn(
            'transition-all duration-700 ease-out',
            shown ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
          )}
        >
          <Pill variant="plum" className="mb-6 inline-block">
            What the research actually says
          </Pill>

          <h1 className="text-ink">
            <span className="block font-sans text-[18px] font-medium leading-snug text-stone-600 sm:text-[21px]">
              Research is rigorous and specific.
            </span>
            <span className="mt-1.5 block font-serif text-[30px] font-normal leading-[1.15] tracking-[-0.015em] sm:text-[40px]">
              Knowing when it applies to you? That&rsquo;s{' '}
              <em className="italic text-plum-500">powerful</em>.
            </span>
          </h1>

          <p className="mt-6 max-w-[34rem] text-[15px] leading-[1.65] text-stone-700 sm:text-base">
            {HERO_SUBHEAD}
          </p>

          <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Button size="lg" onClick={onStart}>
              Try it on yourself &rarr;
            </Button>
            <button
              type="button"
              onClick={scrollToSample}
              className="rounded text-sm text-stone-600 underline-offset-4 outline-none transition-colors hover:text-ink hover:underline focus-visible:ring-2 focus-visible:ring-plum-500 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
            >
              Not sure? Here&rsquo;s what you might expect
            </button>
          </div>
        </div>
      </section>

      {/* ── 2. SAMPLE READOUT ─────────────────────────────────────────────── */}
      <section
        id="sample"
        className="mx-auto w-full max-w-wide scroll-mt-20 px-5 py-12 sm:px-6 sm:py-16"
      >
        <div className="mb-2 flex items-center gap-3">
          <span className="text-[11px] uppercase tracking-meta text-stone-500">
            A sample readout
          </span>
          <Pill variant="stone" size="sm">
            Example
          </Pill>
        </div>
        <p className="mb-7 max-w-[40rem] text-sm leading-[1.6] text-stone-600">
          This is the kind of readout you&rsquo;ll get — your demographic built into
          every finding, an honest grade on the right, and the sources behind it one
          tap away. Shown here for a woman, 35&ndash;44.
        </p>

        {/* Grade-ramp legend */}
        <div className="mb-8 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-lg border-hairline border-stone-200 bg-white px-5 py-4">
          {GRADE_LEGEND.map(({ grade, label }) => (
            <div key={grade} className="flex items-center gap-2">
              <GradeTile grade={grade} size="sm" />
              <span className="text-[13px] text-stone-700">{label}</span>
            </div>
          ))}
        </div>

        {/* Real, interactive cards driven by static sample data */}
        <div className="flex flex-col gap-4">
          {SAMPLE_CARDS.map((card) => (
            <AdviceCard key={card.domain} card={card} />
          ))}
        </div>

        <p className="mt-5 text-[12px] leading-[1.6] text-stone-500">
          Illustrative example, not medical advice. A live readout draws its sources
          from current published research for the demographic you enter.
        </p>
      </section>

      {/* ── 3. CLOSING CTA ────────────────────────────────────────────────── */}
      <section className="bg-ink">
        <div className="mx-auto w-full max-w-page px-5 py-14 text-center sm:px-6 sm:py-20">
          <h2 className="mx-auto max-w-[28rem] font-serif font-normal tracking-[-0.02em] text-paper text-[24px] leading-[1.2] sm:text-[34px]">
            See what the research has to say about you.
          </h2>
          <div className="mt-8 flex justify-center">
            <Button
              size="lg"
              onClick={onStart}
              className="border-paper bg-paper text-ink hover:bg-stone-100 hover:-translate-y-px"
            >
              Try it on yourself &rarr;
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
