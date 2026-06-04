import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/cn';

type CardVariant = 'default' | 'required';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

/**
 * Card primitive — white surface with hairline border + lg radius.
 *
 * Variants:
 *   default  — 0.5px hairline border, the standard form card or content card
 *   required — 1px solid border, used to mark the spine of the intake form
 *              (the Required section + the Submit card both use this)
 *
 * Padding is left to the consumer — different cards need different padding
 * (28px 32px for desktop form cards, 16px 18px for mobile, etc.)
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'bg-white rounded-lg',
          variant === 'default' && 'border-hairline border-stone-200',
          variant === 'required' && 'border border-stone-300',
          className
        )}
        {...props}
      />
    );
  }
);

Card.displayName = 'Card';
