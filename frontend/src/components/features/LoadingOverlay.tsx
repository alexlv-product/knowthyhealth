import { useEffect, useRef, useState } from 'react';
import { Logo, LoadingDots } from '../ui';
import { cn } from '../../lib/cn';

interface LoadingOverlayProps {
  /** Cancel the in-flight request and return to the (preserved) form (§7.3). */
  onCancel?: () => void;
}

const PHASES = [
  { key: 'profile', label: 'Profile processed', note: 'reading your intake' },
  { key: 'sources', label: 'Pulling sources', note: 'searching authoritative research' },
  { key: 'grading', label: 'Grading evidence', note: 'scoring each finding A–F' },
  { key: 'composing', label: 'Composing readout', note: 'writing your domain cards' },
] as const;

// Soft schedule (seconds) at which each phase becomes active. The last phase
// stays active until the request resolves — we don't fake a "done" we can't see.
const PHASE_START = [0, 3, 7, 12];
const HANG_AT = 45; // seconds (§5.1)

/**
 * LoadingOverlay — the four-phase progress card (PRD v1.4 §7).
 *
 * The single round-trip gives no real progress events, so phases advance on a
 * soft schedule; the elapsed-seconds meta is honest (actual wall-clock). At 45s
 * the surface shifts to the amber "hang" state. A quiet cancel link returns to
 * the form with intake preserved.
 */
export function LoadingOverlay({ onCancel }: LoadingOverlayProps) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 250);
    return () => clearInterval(id);
  }, []);

  const activeIndex = PHASE_START.reduce(
    (acc, start, i) => (elapsed >= start ? i : acc),
    0
  );
  const hanging = elapsed >= HANG_AT;

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-page flex-col items-center px-6 pt-6 text-center">
      <div
        className={cn(
          'pulse-ring mb-7 flex h-14 w-14 items-center justify-center rounded-full',
          hanging ? 'pulse-ring-warn bg-warn-bg' : 'bg-plum-50'
        )}
      >
        <Logo variant="mark" size={26} />
      </div>

      <p
        className={cn(
          'animate-title-breathe font-serif text-[20px] leading-snug',
          hanging ? 'text-warn-textBold' : 'text-ink'
        )}
      >
        {hanging ? "This one's taking a minute" : 'Building your readout'}
        <LoadingDots />
      </p>
      <p className="mt-3 max-w-sm text-[13px] leading-[1.6] text-stone-500">
        {hanging
          ? 'Authoritative search and grading can run long when sources are slow. We\u2019ll keep going for up to two minutes before stopping.'
          : 'Searching authoritative sources and grading the evidence for your gender and age range.'}
      </p>

      {/* Phase list */}
      <ol className="mt-8 w-full max-w-xs space-y-3 text-left">
        {PHASES.map((phase, i) => {
          const state = i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'pending';
          const phaseElapsed =
            state === 'done'
              ? `${PHASE_START[i + 1] ?? PHASE_START[i]}s`
              : state === 'active'
                ? `${elapsed}s`
                : '\u2014';
          return (
            <li key={phase.key} className="flex items-center gap-3">
              <PhaseIcon state={state} index={i} hanging={hanging && state === 'active'} />
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    'block text-[13px] font-medium',
                    state === 'pending' ? 'text-stone-400' : 'text-ink'
                  )}
                >
                  {phase.label}
                  {state === 'active' && <LoadingDots />}
                </span>
                <span className="block text-[11px] text-stone-500">{phase.note}</span>
              </span>
              <span
                className={cn(
                  'font-mono text-[10px] tracking-meta',
                  hanging && state === 'active' ? 'text-warn-border' : 'text-stone-400'
                )}
              >
                {phaseElapsed}
              </span>
            </li>
          );
        })}
      </ol>

      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="mt-8 rounded text-[12.5px] text-stone-500 underline-offset-2 outline-none hover:text-ink hover:underline focus-visible:ring-2 focus-visible:ring-plum-500 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        >
          Cancel and return to form
        </button>
      )}
    </div>
  );
}

function PhaseIcon({
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
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-hairline border-stone-300 bg-white text-[11px] text-stone-400">
      {index + 1}
    </span>
  );
}
