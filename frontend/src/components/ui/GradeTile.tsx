import { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';
type GradeTileSize = 'sm' | 'md' | 'lg' | 'xl';

interface GradeTileProps extends HTMLAttributes<HTMLDivElement> {
  grade: Grade;
  size?: GradeTileSize;
}

// Tile background colors — saturated, distinct hues per grade
const tileColors: Record<Grade, string> = {
  A: 'bg-grade-a', // plum #6D3F73
  B: 'bg-grade-b', // sage #4D6638
  C: 'bg-grade-c', // sand #876B36
  D: 'bg-grade-d', // copper #874425
  F: 'bg-grade-f', // deep red #6E1E1E
};

// Size variants — letter font-size scales with tile dimensions
const sizeStyles: Record<GradeTileSize, { tile: string; letter: string }> = {
  sm: { tile: 'w-[38px] h-[38px] rounded-[8px]', letter: 'text-[24px]' },
  md: { tile: 'w-[44px] h-[44px] rounded-[8px]', letter: 'text-[28px]' },
  lg: { tile: 'w-[56px] h-[56px] rounded-[10px]', letter: 'text-[36px]' },
  xl: { tile: 'w-16 h-16 rounded-[11px]', letter: 'text-[40px]' },
};

/**
 * GradeTile — the saturated colored block bearing an A–F serif letter.
 *
 * This is the most visually loaded element in the system. The tile carries
 * the brand color (plum for A) and the grade ramp identity across the page.
 * Letter is always paper-white; tile background is grade-specific.
 *
 * Sizes:
 *   sm  — methodology cards on mobile, compact lists
 *   md  — mobile advice cards
 *   lg  — landing sample cards, methodology cards on desktop
 *   xl  — desktop advice cards (the standard hero-of-card size)
 */
export function GradeTile({ grade, size = 'xl', className, ...props }: GradeTileProps) {
  const { tile, letter } = sizeStyles[size];

  return (
    <div
      className={cn(
        'flex items-center justify-center shrink-0',
        tile,
        tileColors[grade],
        className
      )}
      aria-label={`Grade ${grade}`}
      {...props}
    >
      <span
        className={cn(
          'font-serif font-medium leading-none text-paper',
          'tracking-[-0.04em]',
          letter
        )}
      >
        {grade}
      </span>
    </div>
  );
}
