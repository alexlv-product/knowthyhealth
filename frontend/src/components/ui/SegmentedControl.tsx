import { cn } from '../../lib/cn';

interface SegmentOption {
  value: string;
  label: string;
}

interface SegmentedControlProps {
  options: SegmentOption[];
  value: string | undefined;
  onChange: (value: string) => void;
  /** ARIA label for the group. Required for accessibility. */
  ariaLabel: string;
  className?: string;
}

/**
 * SegmentedControl — horizontal pill of mutually exclusive options.
 *
 * Used for ordered scales: Activity (Sedentary → Very active), Sleep
 * (Poor → Excellent), and as a presentation choice for any small ordered
 * field. NOT a replacement for Select — selects handle long lists better.
 *
 * Active option fills plum-500 with paper text. This is the second of
 * only two places in the system where plum appears as a routine
 * interaction state (the other being the checkbox check). Together they
 * create a visual rhythm down a completed form: plum-checked dropdowns,
 * plum-active segments, plum-checked disclaimer.
 *
 * Hover on inactive options brightens to white background — signals
 * tappability without committing to a selection.
 */
export function SegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedControlProps) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'flex gap-1 bg-stone-100 border border-stone-200 rounded-[9px] p-1',
        className
      )}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex-1 px-3 py-[10px] text-center text-[13px] font-medium',
              'rounded-md cursor-pointer transition-all duration-100 font-sans',
              isActive
                ? 'bg-plum-500 text-paper'
                : 'text-stone-700 hover:text-ink hover:bg-white'
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
