import { cn } from '../../lib/cn';

interface LoadingDotsProps {
  className?: string;
}

/**
 * LoadingDots — three plum dots pulsing in sequence.
 *
 * The animation lives in index.css (`.loading-dots`) because the staggered
 * nth-child delays are awkward to express inline. This component is just the
 * markup hook. Sits inline after a loading title or inside a phase label.
 */
export function LoadingDots({ className }: LoadingDotsProps) {
  return (
    <span className={cn('loading-dots', className)} aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}
