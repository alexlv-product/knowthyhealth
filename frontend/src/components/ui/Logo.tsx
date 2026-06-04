import { cn } from '../../lib/cn';

type LogoVariant = 'mark' | 'lockup';
type LogoTheme = 'light' | 'dark';

interface LogoProps {
  /**
   * mark   — K + plum [1] superscript only. Used in navbars, favicons,
   *          mobile surfaces, anywhere below ~640px viewport.
   * lockup — full lockup with gray rule + "thy health" baseline. Reserved
   *          for hero, footer, about page, and other large-format surfaces.
   */
  variant?: LogoVariant;
  /**
   * light — for paper backgrounds (default)
   * dark  — for ink backgrounds (footer CTA, dark surfaces)
   */
  theme?: LogoTheme;
  /**
   * Pixel size for the K letterform. Bracket, rule, and baseline scale
   * proportionally from this. Default 32 (navbar size).
   *
   * Common sizes:
   *   26   — mobile navbar
   *   32   — desktop navbar
   *   44   — mobile footer CTA
   *   56   — desktop footer CTA
   *   60   — about / methodology page headers
   *   80   — large hero specimen
   */
  size?: number;
  className?: string;
}

/**
 * The brand mark. Locked specifications:
 *   - K rendered in Source Serif 4, weight 400, -0.04em tracking
 *   - Bracket [1] in JetBrains Mono, weight 500, plum-500 (or plum-400 on dark)
 *   - Bracket positioned as superscript: top-aligned with K, ~25% of K size
 *   - Lockup adds: 0.5px gray rule, "thy health" baseline in Inter caps with
 *     0.22em letter-spacing, ~16% of K size
 *
 * The lockup degrades gracefully — at very small K sizes the bracket
 * collapses to a plum dot. That fallback is rendered automatically when
 * size <= 18.
 */
export function Logo({
  variant = 'mark',
  theme = 'light',
  size = 32,
  className,
}: LogoProps) {
  // Proportional sub-element sizing derived from the K size
  const bracketSize = Math.round(size * 0.25);
  const bracketMarginTop = Math.round(size * 0.094);
  const baselineSize = Math.max(Math.round(size * 0.16), 5);
  const ruleMargin = Math.round(size * 0.08);

  // Color tokens based on theme
  const letterColor = theme === 'light' ? '#1C1917' : '#FAFAF9';
  const bracketColor = theme === 'light' ? '#6D3F73' : '#B689BD';
  const ruleColor = theme === 'light' ? '#E7E5E4' : '#44403C';
  const baselineColor = theme === 'light' ? '#57534E' : '#A8A29E';

  // At very small sizes, the bracket collapses to a dot — the K is still
  // recognizable as the mark even when [1] would be illegible noise
  const useDot = size <= 18;

  const markElement = (
    <div className="flex items-start">
      <span
        className="font-serif font-normal leading-[0.85] tracking-[-0.04em]"
        style={{ fontSize: `${size}px`, color: letterColor }}
      >
        K
      </span>
      {useDot ? (
        <span
          className="font-bold"
          style={{
            fontSize: `${bracketSize}px`,
            color: bracketColor,
            marginTop: `${bracketMarginTop}px`,
          }}
        >
          ·
        </span>
      ) : (
        <span
          className="font-mono font-medium"
          style={{
            fontSize: `${bracketSize}px`,
            color: bracketColor,
            marginTop: `${bracketMarginTop}px`,
          }}
        >
          [1]
        </span>
      )}
    </div>
  );

  if (variant === 'mark') {
    return <div className={cn('inline-flex', className)}>{markElement}</div>;
  }

  return (
    <div className={cn('inline-flex flex-col items-center', className)}>
      {markElement}
      <div
        className="w-full"
        style={{
          height: '0.5px',
          backgroundColor: ruleColor,
          margin: `${ruleMargin}px 0`,
        }}
      />
      <div
        className="font-sans font-medium uppercase tracking-baseline"
        style={{ fontSize: `${baselineSize}px`, color: baselineColor }}
      >
        thy health
      </div>
    </div>
  );
}
