import { InputHTMLAttributes, ReactNode, forwardRef } from 'react';
import { cn } from '../../lib/cn';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
}

/**
 * Checkbox — appearance-none + custom checkmark drawn via CSS pseudo-element.
 *
 * When checked, fills plum-500 with paper-white checkmark. This is one of
 * only two places in the system where plum appears as a routine
 * interaction state (the other is the active segmented control option).
 *
 * The label prop is intentional: most checkboxes in this product (the
 * intake disclaimer specifically) have multi-line label text that needs
 * its own wrapping. Pass label as a string or ReactNode for richer markup.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, className, ...props }, ref) => {
    const checkbox = (
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          'appearance-none w-[18px] h-[18px] shrink-0',
          'border border-stone-500 rounded-[4px] bg-white cursor-pointer',
          'transition-all duration-100',
          'hover:border-plum-500',
          'checked:bg-plum-500 checked:border-plum-500',
          // Drawn checkmark — paper-white tick rotated 45° from a partial border
          'relative',
          'checked:after:content-[""] checked:after:absolute',
          'checked:after:left-[5px] checked:after:top-[1px]',
          'checked:after:w-[5px] checked:after:h-[10px]',
          'checked:after:border-solid checked:after:border-white',
          'checked:after:border-[0_2px_2px_0]',
          'checked:after:rotate-45',
          'mt-px',
          className
        )}
        {...props}
      />
    );

    if (!label) return checkbox;

    return (
      <label className="flex items-start gap-[10px] cursor-pointer">
        {checkbox}
        <span className="text-[13px] text-stone-700 leading-[1.5]">{label}</span>
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';
