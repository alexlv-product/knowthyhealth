import {
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  SelectHTMLAttributes,
  forwardRef,
} from 'react';
import { cn } from '../../lib/cn';

/**
 * The form input family — text input, textarea, custom-styled select.
 *
 * All three share a consistent state vocabulary:
 *
 *   default — 1px stone-300 border, white background
 *   hover   — border deepens to stone-500
 *   focus   — border shifts to plum, 3px plum focus ring
 *   filled  — slight stone-50 background, stone-400 border
 *             (passed as a prop because parent decides what "filled" means)
 *
 * The filled state is the single most useful affordance in the form — it
 * lets the user see at a glance which fields they've completed without an
 * explicit progress indicator.
 */

const baseInputStyles =
  'w-full font-sans text-sm text-ink bg-white border border-stone-300 rounded ' +
  'px-[14px] py-[11px] box-border ' +
  'placeholder:text-stone-500 ' +
  'transition-[border-color,box-shadow,background] duration-100 ' +
  'hover:border-stone-500 ' +
  'focus:outline-none focus:border-plum-500 focus:shadow-focus';

const filledStyles = 'bg-stone-50 border-stone-400 focus:bg-white';

// ────────────────────────────────────────────────────────────────────────────
// Input — text fields
// ────────────────────────────────────────────────────────────────────────────
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  filled?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ filled = false, className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(baseInputStyles, filled && filledStyles, className)}
      {...props}
    />
  )
);
Input.displayName = 'Input';

// ────────────────────────────────────────────────────────────────────────────
// Textarea
// ────────────────────────────────────────────────────────────────────────────
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  filled?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ filled = false, className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        baseInputStyles,
        'resize-y leading-relaxed',
        filled && filledStyles,
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = 'Textarea';

// ────────────────────────────────────────────────────────────────────────────
// Select — native select with custom-styled chevron
// ────────────────────────────────────────────────────────────────────────────
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  filled?: boolean;
}

/**
 * Select uses appearance-none + a chevron background-image (defined in
 * index.css as `.select-chevron`). The right padding of 44px gives the
 * value text proper clearance from the chevron.
 *
 * Why not a custom listbox? Native selects respect platform conventions
 * (especially on mobile, where the OS picker is significantly better than
 * any web reimplementation), they're accessible by default, and they're
 * one tag instead of 100 lines of state machinery.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ filled = false, className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        baseInputStyles,
        'select-chevron cursor-pointer pr-11 appearance-none',
        filled && filledStyles,
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = 'Select';
