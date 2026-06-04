/**
 * adviceApi — the single network entry point for the frontend.
 *
 *   - POST the request body to /api/v1/advice
 *   - On 200: return the parsed AdviceResponse
 *   - On 4xx/5xx: throw a structured ApiError (never a raw fetch error),
 *     carrying the backend's opaque supportReference when present (§5.2)
 *   - On network failure / CORS / timeout: throw a NETWORK_ERROR
 *
 * The backend guarantees safe, display-ready `message` strings on every error
 * envelope, so we surface those directly. An optional external `signal` lets the
 * loading UI cancel an in-flight request (§7.3).
 */

import type { AdviceRequest, AdviceResponse, ApiError } from '../types/api';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

/** Hard client ceiling — matches the 2-minute timeout commitment (§5.1). */
const CLIENT_TIMEOUT_MS = 200_000;

function isApiErrorShape(
  body: unknown
): body is { error: string; message: string; supportReference?: string } {
  return (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    'message' in body &&
    typeof (body as Record<string, unknown>).message === 'string'
  );
}

export async function fetchAdvice(
  request: AdviceRequest,
  signal?: AbortSignal
): Promise<AdviceResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
  // Combine the caller's cancel signal with our timeout signal.
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/advice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
  } catch {
    // fetch() rejects on CORS rejection, offline, DNS, or abort (timeout/cancel).
    const networkError: ApiError = {
      code: 'NETWORK_ERROR',
      message:
        "We couldn't reach the server. Please check your connection and try again.",
    };
    throw networkError;
  } finally {
    clearTimeout(timeout);
  }

  if (response.ok) {
    return (await response.json()) as AdviceResponse;
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    /* body may be empty or non-JSON; fall through to a generic message */
  }

  const retryAfterHeader = response.headers.get('Retry-After');
  const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : null;

  if (isApiErrorShape(body)) {
    const apiError: ApiError = {
      code: body.error as ApiError['code'],
      message: body.message,
      retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : null,
      supportReference: body.supportReference ?? null,
    };
    throw apiError;
  }

  const fallback: ApiError = {
    code: response.status === 429 ? 'RATE_LIMIT_ERROR' : 'INTERNAL_ERROR',
    message:
      response.status === 429
        ? "We're experiencing high demand right now. Please wait a moment and try again."
        : 'An unexpected error occurred. Please try again.',
    retryAfterSeconds: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : null,
    supportReference: null,
  };
  throw fallback;
}
