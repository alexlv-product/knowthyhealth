import { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type SectionLabelVariant = 'plum' | 'muted';

interface SectionLabelProps extends HTMLAttributes<HTMLDivElement> {
  variant?: SectionLabelVariant;
}

/**
 * SectionLabel — the small uppercase plum text that sits above section
 * headings and signals "what kind of section this is."
 *
 * 11px / 500 weight / 0.12em letter-spacing / plum-500 by default.
 *
 * Variants:
 *   plum  — default; primary section anchor (most uses)
 *   muted — gray version, used for optional sections in the form where
 *           plum is reserved for the required spine
 *
 * Examples in use: "Your readout", "How it works", "The grading",
 * "Required", "Baseline", "Concerns", "Evidence", etc.
 */
export function SectionLabel({
  variant = 'plum',
  className,
  ...props
}: SectionLabelProps) {
  return (
    <div
      className={cn(
        'text-[11px] font-medium uppercase tracking-label font-sans',
        variant === 'plum' && 'text-plum-500',
        variant === 'muted' && 'text-stone-500',
        className
      )}
      {...props}
    />
  );
}
