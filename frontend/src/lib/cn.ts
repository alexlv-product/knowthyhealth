/**
 * Tiny class-name utility. Joins truthy class fragments with spaces.
 *
 * Why not clsx? At this scale, a 10-line local helper has zero dependencies
 * and is easier to audit than a third-party package.
 *
 * @example
 *   cn('btn', isPrimary && 'btn-primary', disabled && 'opacity-50')
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
