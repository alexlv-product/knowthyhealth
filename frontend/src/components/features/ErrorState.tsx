import { useEffect, useState } from 'react';
import { Button } from '../ui';
import { cn } from '../../lib/cn';
import type { ApiError } from '../../types/api';

interface ErrorStateProps {
  error: ApiError;
  /** Re-fire the request (or, for validation, return to the form). */
  onRetry: () => void;
  /** Always return to the (preserved) intake form. */
  onEditIntake: () => void;
}

/**
 * ErrorState — the four distinct failure surfaces (PRD v1.4 §5.1).
 *
 * Visual vocabulary (§5.3): amber = recoverable / degraded; red = hard failure.
 * Plum never appears in an error. Only the opaque supportReference is shown — no
 * codes, stages, timestamps, or stack traces (§5.2). Tavily-degraded is NOT here;
 * it renders as an amber banner above an all-F readout (AdviceCardGrid).
 *
 *   NETWORK_ERROR           → amber "Can't reach the server" (offline/CORS)
 *   ADVICE_GENERATION_ERROR → red "The composition step failed"
 *   INTERNAL_ERROR          → red, generic
 *   RATE_LIMIT_ERROR        → amber, retry gated by a live countdown
 *   VALIDATION_ERROR        → amber, return to the form
 */
export function ErrorState({ error, onRetry, onEditIntake }: ErrorStateProps) {
  const isNetwork = error.code === 'NETWORK_ERROR';
  const isRateLimit = error.code === 'RATE_LIMIT_ERROR';
  const isValidation = error.code === 'VALIDATION_ERROR';
  const isHardFailure = error.code === 'ADVICE_GENERATION_ERROR' || error.code === 'INTERNAL_ERROR';

  const tone: 'amber' | 'red' = isHardFailure ? 'red' : 'amber';

  const initialCooldown =
    isRateLimit && error.retryAfterSeconds && error.retryAfterSeconds > 0
      ? Math.ceil(error.retryAfterSeconds)
      : 0;
  const [cooldown, setCooldown] = useState(initialCooldown);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const retryDisabled = cooldown > 0;
  const retryLabel = retryDisabled ? `Try again in ${cooldown}s` : 'Try again';

  const headline = isNetwork
    ? "Can't reach the server"
    : error.code === 'ADVICE_GENERATION_ERROR'
      ? 'The composition step failed'
      : isRateLimit
        ? 'Too many requests right now'
        : isValidation
          ? 'Something in your intake needs a look'
          : 'Something went wrong';

  return (
    <div className="mx-auto flex min-h-[55vh] w-full max-w-page flex-col items-center justify-center px-6 text-center">
      <ErrorIcon tone={tone} network={isNetwork} />

      <h1
        className={cn(
          'mt-6 font-serif text-[22px] leading-[1.3]',
          tone === 'red' ? 'text-danger-textBold' : 'text-warn-textBold'
        )}
      >
        {headline}
      </h1>

      <p className="mt-3 max-w-md text-[14px] leading-[1.6] text-stone-600">
        {error.message}
      </p>

      {isNetwork && (
        <p className="mt-2 max-w-md text-[13px] leading-[1.6] text-stone-500">
          Your intake is saved — nothing is lost. If this keeps happening, the
          service status is at status.knowthyhealth.app.
        </p>
      )}

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        {!isValidation && (
          <Button onClick={onRetry} disabled={retryDisabled}>
            {retryLabel}
          </Button>
        )}
        <Button variant="secondary" onClick={onEditIntake}>
          Edit intake
        </Button>
      </div>

      {error.supportReference && (
        <p className="mt-6 font-mono text-[11px] tracking-meta text-stone-400">
          Reference {error.supportReference}
        </p>
      )}
    </div>
  );
}

function ErrorIcon({ tone, network }: { tone: 'amber' | 'red'; network: boolean }) {
  const ring =
    tone === 'red'
      ? 'border-danger-border text-danger-border'
      : 'border-warn-border text-warn-border';
  return (
    <span
      className={cn(
        'flex h-14 w-14 items-center justify-center rounded-full border-2',
        ring
      )}
      aria-hidden="true"
    >
      {network ? (
        // wifi-off
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 1l22 22" />
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
          <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
      ) : (
        <span className="font-serif text-[26px] leading-none">!</span>
      )}
    </span>
  );
}
