import { useEffect, useRef, useState } from 'react';
import { Logo, LoadingDots, SectionLabel } from '../ui';
import { AdviceCard } from './AdviceCard';
import { cn } from '../../lib/cn';
import type { AdviceCard as AdviceCardData } from '../../types/api';
import type { StreamStage } from '../../api/adviceStream';

interface StreamingReadoutProps {
  /** The pipeline phase reported by the backend, or null before the first event. */
  stage: StreamStage | null;
  /** Cards that have finished generating AND been citation-validated, in order. */
  cards: AdviceCardData[];
  onCancel?: () => void;
}

const STEPS: { key: StreamStage; label: string; note: string }[] = [
  { key: 'intake', label: 'Reading your intake', note: 'identifying research domains' },
  { key: 'citations', label: 'Pulling sources', note: 'searching authoritative research' },
  { key: 'writing', label: 'Composing readout', note: 'writing & verifying each finding' },
];

function fmtClock(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/**
 * StreamingReadout — the loading surface (Option B).
 *
 * A persistent banner sets expectations; the three steps advance on real `stage`
 * events with per-phase timing; and each domain card appears only once it has
 * finished generating AND its citations have been server-validated — so every
 * card shown is fully interactive (open "More") and every source is accurate.
 * A "writing your next finding" cue keeps momentum between cards. On completion,
 * the full readout (summary, evidence, the final card) replaces this view.
 */
export function StreamingReadout({ stage, cards, onCancel }: StreamingReadoutProps) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());
  const stageStartRef = useRef<Partial<Record<StreamStage, number>>>({});

  useEffect(() => {
    const id = setInterval(() => setElapsed((Date.now() - startRef.current) / 1000), 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (stage && stageStartRef.current[stage] === undefined) {
      stageStartRef.current[stage] = (Date.now() - startRef.current) / 1000;
    }
  }, [stage]);

  const activeIndex = stage ? STEPS.findIndex((s) => s.key === stage) : 0;
  const writing = stage === 'writing';
  const hanging = elapsed >= 90;

  return (
    <div className="mx-auto w-full max-w-wide px-5 pt-6 sm:px-6">
      {/* Header */}
      <div className="flex flex-col items-center text-center">
        <div
          className={cn(
            'pulse-ring mb-6 flex h-14 w-14 items-center justify-center rounded-full',
            hanging ? 'pulse-ring-warn bg-warn-bg' : 'bg-plum-50'
          )}
        >
          <Logo variant="mark" size={26} />
        </div>
        <p className="animate-title-breathe font-serif text-[20px] leading-snug text-ink">
          Building your readout
          <LoadingDots />
        </p>
        <span
          className={cn(
            'mt-3 font-mono text-[13px] tabular-nums tracking-meta',
            hanging ? 'text-warn-border' : 'text-stone-400'
          )}
        >
          {fmtClock(elapsed)}
        </span>
      </div>

      {/* Persistent expectation banner */}
      <div className="mx-auto mt-7 max-w-xl rounded-lg border-hairline border-plum-200 bg-plum-50 px-4 py-3">
        <p className="text-[12.5px] leading-[1.6] text-ink">
          We’re surfacing research for your gender and age range and grading the evidence.
          Each finding appears below <span className="font-medium">only after its sources are verified</span> —
          so anything you see is accurate and ready to open with <span className="font-medium">More</span>.
        </p>
      </div>

      {/* Step list with per-phase timing */}
      <ol className="mx-auto mt-7 w-full max-w-xs space-y-3 text-left">
        {STEPS.map((step, i) => {
          const state = i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'pending';
          const start = stageStartRef.current[step.key];
          const nextStart = stageStartRef.current[STEPS[i + 1]?.key as StreamStage];
          let timeLabel = '—';
          if (state === 'done' && start !== undefined) {
            timeLabel = `${Math.max(0, Math.round((nextStart ?? elapsed) - start))}s`;
          } else if (state === 'active' && start !== undefined) {
            timeLabel = `${Math.round(elapsed - start)}s`;
          }
          return (
            <li key={step.key} className="flex items-center gap-3">
              <StepIcon state={state} index={i} hanging={hanging && state === 'active'} />
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    'block text-[13px] font-medium',
                    state === 'pending' ? 'text-stone-400' : 'text-ink'
                  )}
                >
                  {step.label}
                  {state === 'active' && <LoadingDots />}
                </span>
                <span className="block text-[11px] text-stone-500">{step.note}</span>
              </span>
              <span
                className={cn(
                  'font-mono text-[10px] tabular-nums tracking-meta',
                  hanging && state === 'active' ? 'text-warn-border' : 'text-stone-400'
                )}
              >
                {timeLabel}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Verified cards, building in */}
      {(cards.length > 0 || writing) && (
        <div className="mx-auto mt-10 w-full max-w-wide">
          <div className="mb-4 flex items-baseline justify-between">
            <SectionLabel>Your readout</SectionLabel>
            <span className="font-mono text-[10px] tracking-meta text-stone-400">
              {cards.length} verified{writing ? ' · still writing' : ''}
            </span>
          </div>
          <div className="flex flex-col gap-4">
            {cards.map((card, i) => (
              <div key={i} className="animate-fade-in">
                <AdviceCard card={card} />
              </div>
            ))}
            {writing && <WritingNext index={cards.length + 1} />}
          </div>
        </div>
      )}

      {onCancel && (
        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={onCancel}
            className="rounded text-[12.5px] text-stone-500 underline-offset-2 outline-none hover:text-ink hover:underline focus-visible:ring-2 focus-visible:ring-plum-500 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
          >
            Cancel and return to form
          </button>
        </div>
      )}
    </div>
  );
}

/** A quiet placeholder for the finding currently being written + verified. */
function WritingNext({ index }: { index: number }) {
  return (
    <div className="flex items-center gap-4 rounded-lg border-hairline border-dashed border-stone-300 bg-white/60 p-5">
      <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[8px] border border-stone-200 bg-stone-50">
        <LoadingDots />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-mono text-[10px] uppercase tracking-meta text-stone-400">
          finding {index}
        </span>
        <span className="mt-0.5 block text-[13px] text-stone-500">
          Writing and verifying sources<LoadingDots />
        </span>
      </span>
    </div>
  );
}

function StepIcon({
  state,
  index,
  hanging,
}: {
  state: 'done' | 'active' | 'pending';
  index: number;
  hanging: boolean;
}) {
  if (state === 'done') {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-plum-500 text-[12px] text-paper">
        ✓
      </span>
    );
  }
  if (state === 'active') {
    return (
      <span
        className={cn(
          'pulse-ring flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 bg-white text-[11px] font-medium',
          hanging ? 'pulse-ring-warn border-warn-border text-warn-border' : 'border-plum-500 text-plum-500'
        )}
      >
        {index + 1}
      </span>
    );
  }
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-stone-300 bg-white text-[11px] text-stone-400">
      {index + 1}
    </span>
  );
}
