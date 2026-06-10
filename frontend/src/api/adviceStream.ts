/**
 * adviceStream — streaming counterpart to adviceApi.fetchAdvice.
 *
 * POSTs the intake to /api/v1/advice/stream and consumes a Server-Sent Events
 * stream so the readout can render progressively as Claude writes it:
 *
 *   stage  → which pipeline phase is running (intake | citations | writing)
 *   card   → one fully-written, citation-VALIDATED AdviceCard (Option B): emitted
 *            the moment a card finishes generating, already safe to display/open
 *   done   → the SAME schema-validated AdviceResponse the non-stream endpoint
 *            returns; treat it as the source of truth (summary, evidence, the
 *            final card set incl. the last one) and render the full readout
 *   error  → a structured ApiError (validation 400 arrives as a normal JSON body,
 *            everything else as an `error` event)
 *
 * Network/CORS/timeout/abort all surface through onError as NETWORK_ERROR, mirroring
 * fetchAdvice so the caller's error handling is identical.
 */

import type { AdviceCard, AdviceRequest, AdviceResponse, ApiError } from '../types/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

/** Hard client ceiling — matches the 2-minute commitment (§5.1), with headroom. */
const CLIENT_TIMEOUT_MS = 200_000;

export type StreamStage = 'intake' | 'citations' | 'writing';

export interface StreamHandlers {
  onStage?: (stage: StreamStage) => void;
  /** Called with each fully-written, citation-validated card as it completes. */
  onCard?: (card: AdviceCard, index: number) => void;
  onDone?: (response: AdviceResponse) => void;
  onError?: (error: ApiError) => void;
}

export async function streamAdvice(
  request: AdviceRequest,
  handlers: StreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/advice/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
  } catch {
    clearTimeout(timeout);
    handlers.onError?.({
      code: 'NETWORK_ERROR',
      message: "We couldn't reach the server. Please check your connection and try again.",
    });
    return;
  }

  // A rejected request (e.g. validation 400, or 429) comes back as a normal JSON
  // envelope, not an SSE stream.
  if (!response.ok || !response.body) {
    clearTimeout(timeout);
    let body: { error?: string; message?: string; supportReference?: string } | null = null;
    try {
      body = await response.json();
    } catch {
      /* non-JSON body — fall through to a generic message */
    }
    const retryAfter = response.headers.get('Retry-After');
    handlers.onError?.({
      code: (body?.error as ApiError['code']) ?? (response.status === 429 ? 'RATE_LIMIT_ERROR' : 'INTERNAL_ERROR'),
      message: body?.message ?? 'An unexpected error occurred. Please try again.',
      retryAfterSeconds: retryAfter ? Number(retryAfter) : null,
      supportReference: body?.supportReference ?? null,
    });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finished = false;

  const dispatch = (rawEvent: string) => {
    let event = 'message';
    let data = '';
    for (const line of rawEvent.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data += line.slice(5).replace(/^ /, '');
    }
    if (!data) return;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(data);
    } catch {
      return; // ignore malformed frame
    }
    switch (event) {
      case 'stage':
        handlers.onStage?.(parsed.stage as StreamStage);
        break;
      case 'card':
        handlers.onCard?.(parsed.card as AdviceCard, (parsed.index as number) ?? 0);
        break;
      case 'done':
        finished = true;
        handlers.onDone?.(parsed.response as AdviceResponse);
        break;
      case 'error':
        finished = true;
        handlers.onError?.({
          code: parsed.error as ApiError['code'],
          message: (parsed.message as string) ?? 'An unexpected error occurred. Please try again.',
          retryAfterSeconds: (parsed.retryAfterSeconds as number) ?? null,
          supportReference: (parsed.supportReference as string) ?? null,
        });
        break;
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        if (rawEvent.trim()) dispatch(rawEvent);
      }
    }
  } catch {
    if (!finished) {
      handlers.onError?.({
        code: 'NETWORK_ERROR',
        message: 'The connection was interrupted. Please try again.',
      });
    }
    return;
  } finally {
    clearTimeout(timeout);
  }

  if (!finished) {
    handlers.onError?.({
      code: 'INTERNAL_ERROR',
      message: 'The response ended unexpectedly. Please try again.',
    });
  }
}
