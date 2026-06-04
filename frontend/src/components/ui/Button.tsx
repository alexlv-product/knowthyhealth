import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'default' | 'sm' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-ink text-paper border border-ink hover:bg-ink-800 hover:-translate-y-px disabled:bg-stone-200 disabled:text-stone-500 disabled:border-stone-200 disabled:hover:translate-y-0 disabled:cursor-not-allowed',
  secondary:
    'bg-transparent text-ink border border-stone-700 hover:border-ink',
  ghost:
    'bg-transparent text-stone-700 border border-transparent hover:text-ink',
};

const sizeStyles: Record<ButtonSize, string> = {
  default: 'px-[22px] py-3 text-sm',
  sm: 'px-3 py-2 text-[13px]',
  lg: 'px-7 py-[14px] text-sm',
};

/**
 * Button primitive used everywhere a tap target needs the brand treatment.
 *
 * Variants:
 *   primary    — ink-black solid; the headline action of a surface
 *   secondary  — transparent with ink border; the alternative action
 *   ghost      — text-only, no border at rest; tertiary or in-row actions
 *
 * Sizes:
 *   default — 14px text, normal padding (most uses)
 *   sm      — 13px text, tighter padding (in-card actions)
 *   lg      — 14px text, generous padding (hero / footer CTAs)
 *
 * Full-width is its own prop because it's the standard mobile CTA pattern
 * and worth being explicit about, not a size variant.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'default', fullWidth = false, className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-medium rounded transition-all duration-100 cursor-pointer font-sans',
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
