import { ButtonHTMLAttributes, ReactNode, forwardRef } from 'react';
import { cn } from '../../lib/cn';

type ChipVariant = 'default' | 'custom';

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  variant?: ChipVariant;
  /** Renders the × dismiss control inside custom chips */
  onRemove?: () => void;
  children: ReactNode;
}

/**
 * Chip — selectable rounded pill, used for symptoms multi-select.
 *
 * States:
 *   default + inactive — white bg, stone border, ink text
 *                        hover: plum border + text + faint plum tint
 *   default + active   — ink-black bg, paper text (the "selected" treatment)
 *   custom             — user-added chips: plum-tinted bg, plum text, ×
 *                        dismiss button. Always rendered "active" since the
 *                        user explicitly added them.
 *
 * The visual difference between preset-active and custom-added is
 * deliberate: it lets the user see at a glance which entries they added
 * themselves vs which came from the curated list.
 */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(
  ({ active = false, variant = 'default', onRemove, children, className, ...props }, ref) => {
    if (variant === 'custom') {
      return (
        <button
          ref={ref}
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 px-3 pr-2 py-[7px]',
            'bg-plum-100 text-plum-500 border border-plum-200',
            'rounded-full font-sans font-medium text-[13px] cursor-pointer transition-all duration-100',
            className
          )}
          {...props}
        >
          {children}
          {onRemove && (
            <span
              role="button"
              aria-label="Remove"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="text-plum-500 text-[15px] leading-none ml-0.5 opacity-70 hover:opacity-100 cursor-pointer"
            >
              ×
            </span>
          )}
        </button>
      );
    }

    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          'inline-flex items-center gap-1.5 px-[13px] py-[7px]',
          'rounded-full font-sans font-medium text-[13px] cursor-pointer transition-all duration-100',
          active
            ? 'bg-ink text-paper border border-ink hover:bg-ink-800'
            : 'bg-white text-ink border border-stone-300 hover:border-plum-500 hover:text-plum-500 hover:bg-plum-50',
          className
        )}
        aria-pressed={active}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Chip.displayName = 'Chip';
