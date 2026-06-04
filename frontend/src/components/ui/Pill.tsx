import { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type PillVariant = 'plum' | 'stone' | 'clay' | 'sage';
type PillSize = 'default' | 'sm';

interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: PillVariant;
  size?: PillSize;
  /**
   * If true, render as uppercase-tracked label (default for grade labels,
   * the hero pill, evidence tags). Set false for normal-case data chips.
   */
  uppercase?: boolean;
}

const variantStyles: Record<PillVariant, string> = {
  plum: 'bg-plum-100 text-plum-500',
  stone: 'bg-stone-100 text-stone-700 border-hairline border-stone-200',
  clay: 'bg-[#FED7AA] text-[#7C2D12]',
  sage: 'bg-[#DDE6D5] text-[#2F4220]',
};

const sizeStyles: Record<PillSize, string> = {
  default: 'px-[10px] py-1 text-[11px]',
  sm: 'px-[9px] py-[3px] text-[10px]',
};

/**
 * Pill — small inline tag with rounded-full ends.
 *
 * Variants encode meaning. Plum is the brand-positive (used for "Strong
 * evidence" labels, the hero pill, citation references). Stone is neutral
 * (used for "Mixed evidence", category labels). Clay marks weaker evidence.
 * Sage is the moderate-evidence accent.
 *
 * Uppercase=true matches the section-label tracking used throughout the
 * design system; uppercase=false is for data display like "For: weight".
 */
export function Pill({
  variant = 'stone',
  size = 'default',
  uppercase = true,
  className,
  ...props
}: PillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full font-sans',
        variantStyles[variant],
        sizeStyles[size],
        uppercase && 'uppercase tracking-[0.02em]',
        className
      )}
      {...props}
    />
  );
}
