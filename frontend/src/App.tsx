import { useEffect, useRef, useState } from 'react';
import { Logo } from './components/ui';
import {
  Landing,
  InputForm,
  StreamingReadout,
  ResultsPanel,
  ErrorState,
} from './components/features';
import { streamAdvice, type StreamStage } from './api/adviceStream';
import { MEDICAL_DISCLAIMER } from './constants/disclaimer';
import type {
  AdviceCard,
  AdviceRequest,
  AdviceResponse,
  ApiError,
  AppState,
  FormData,
} from './types/api';

const FORM_STORAGE_KEY = 'kth.intake';

/**
 * Shown when retrieval fails AGAIN on a user-initiated retry (the backend is stateless,
 * so the escalation is tracked client-side). The first failure uses the backend's
 * message; a repeat means the outage is persisting, so we stop implying we'll keep
 * auto-trying and give a concrete next step.
 */
const RETRIEVAL_ESCALATED_MESSAGE =
  'We are still not getting the responses we expected. This is out of our hands. ' +
  'Please wait 10 minutes and try again.';

/** The enforced wait (a re-enabling countdown) on the escalated retrieval screen. */
const RETRIEVAL_RETRY_WAIT_SECONDS = 10 * 60;

/** FormData → AdviceRequest. Only the filled fields are sent (§1.2). */
function toRequest(form: FormData): AdviceRequest {
  const condition = form.healthCondition.trim();
  const req: AdviceRequest = {
    gender: form.gender!,
    ageRange: form.ageRange!,
  };
  if (form.symptoms.length) req.symptoms = form.symptoms;
  if (form.diet) req.diet = form.diet;
  if (form.activityLevel) req.activityLevel = form.activityLevel;
  if (form.sleepQuality) req.sleepQuality = form.sleepQuality;
  req.healthCondition = condition.length > 0 ? condition : null;
  return req;
}

/** Read persisted intake (§6.2: sessionStorage, never the URL). */
function loadPersistedForm(): FormData | null {
  try {
    const raw = sessionStorage.getItem(FORM_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as FormData) : null;
  } catch {
    return null;
  }
}

/**
 * App — the root component and the single owner of application state.
 *
 * State machine: landing → idle → loading → results | error.
 *
 * Intake persists to sessionStorage (§6.2) so a 503/network retry or a hard
 * reload within the tab doesn't force re-entry; it does not survive tab close,
 * which keeps the "nothing is stored" promise.
 */
export default function App() {
  const [appState, setAppState] = useState<AppState>('landing');
  const [responseData, setResponseData] = useState<AdviceResponse | null>(null);
  const [lastError, setLastError] = useState<ApiError | null>(null);
  const [lastForm, setLastForm] = useState<FormData | null>(() => loadPersistedForm());

  // Streaming progress for the loading view.
  const [streamStage, setStreamStage] = useState<StreamStage | null>(null);
  const [streamNotice, setStreamNotice] = useState<string | null>(null);
  const [streamedCards, setStreamedCards] = useState<AdviceCard[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);
  // Consecutive RETRIEVAL_UNAVAILABLE failures, to escalate the copy on a repeat retry.
  const retrievalFailsRef = useRef(0);
  const [errorEscalated, setErrorEscalated] = useState(false);

  // Persist the most recent intake.
  useEffect(() => {
    try {
      if (lastForm) sessionStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(lastForm));
    } catch {
      /* storage may be unavailable (private mode) — non-fatal */
    }
  }, [lastForm]);

  async function runRequest(form: FormData) {
    setLastForm(form);
    setAppState('loading');
    setStreamStage(null);
    setStreamNotice(null);
    setStreamedCards([]);
    cancelledRef.current = false;
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await streamAdvice(
        toRequest(form),
        {
          onStage: (stage) => {
            setStreamStage(stage);
            if (stage === 'writing') setStreamNotice(null); // retry cleared it
          },
          onNotice: (message) => setStreamNotice(message),
          onCard: (card) => setStreamedCards((prev) => [...prev, card]),
          onDone: (data) => {
            if (cancelledRef.current) return;
            retrievalFailsRef.current = 0; // success clears the retrieval-failure streak
            setResponseData(data);
            setLastError(null);
            setAppState('results');
          },
          onError: (err) => {
            if (cancelledRef.current) return; // user cancelled — stay on the form
            if (err.code === 'RETRIEVAL_UNAVAILABLE') {
              retrievalFailsRef.current += 1;
              const escalated = retrievalFailsRef.current >= 2;
              setErrorEscalated(escalated);
              setLastError(
                escalated
                  ? {
                      ...err,
                      message: RETRIEVAL_ESCALATED_MESSAGE,
                      retryAfterSeconds: RETRIEVAL_RETRY_WAIT_SECONDS, // gates "Try again" with a countdown
                    }
                  : err
              );
            } else {
              retrievalFailsRef.current = 0; // a different (or no) failure resets the streak
              setErrorEscalated(false);
              setLastError(err);
            }
            setResponseData(null);
            setAppState('error');
          },
        },
        controller.signal
      );
    } finally {
      abortRef.current = null;
    }
  }

  function handleReset() {
    setAppState('idle');
    setResponseData(null);
    setLastError(null);
  }

  /** Landing → intake form. The persisted intake (if any) prefills the form. */
  function handleStart() {
    setAppState('idle');
  }

  /** Brand mark → true home (the landing), clearing any in-hand readout. */
  function handleHome() {
    setResponseData(null);
    setLastError(null);
    setAppState('landing');
  }

  /** Cancel an in-flight request and return to the (preserved) form (§7.3). */
  function handleCancel() {
    cancelledRef.current = true;
    abortRef.current?.abort();
    setAppState('idle');
  }

  /**
   * Retry semantics (§5.1): validation → back to the form (no network); rate
   * limit → re-fire after the cooldown the ErrorState enforces; everything else
   * → re-fire the same request. "Edit intake" always returns to the form.
   */
  function handleRetry() {
    if (lastError?.code === 'VALIDATION_ERROR' || !lastForm) {
      handleReset();
      return;
    }
    void runRequest(lastForm);
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="border-b border-stone-200">
        <div className="mx-auto flex w-full max-w-wide items-center justify-between px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={handleHome}
            aria-label="KnowThyHealth — home"
            className="rounded outline-none focus-visible:ring-2 focus-visible:ring-plum-500 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
          >
            <Logo variant="mark" size={28} />
          </button>
          <span className="text-[11px] uppercase tracking-meta text-stone-500">
            Evidence-graded wellness
          </span>
        </div>
      </header>

      <main className="flex-1 py-8 sm:py-12">
        {appState === 'landing' && <Landing onStart={handleStart} />}
        {appState === 'idle' && (
          <InputForm onSubmit={runRequest} initialValues={lastForm} />
        )}
        {appState === 'loading' && (
          <StreamingReadout
            stage={streamStage}
            notice={streamNotice}
            cards={streamedCards}
            onCancel={handleCancel}
          />
        )}
        {appState === 'results' && responseData && (
          <ResultsPanel responseData={responseData} onReset={handleReset} />
        )}
        {appState === 'error' && lastError && (
          <ErrorState
            error={lastError}
            escalated={errorEscalated}
            onRetry={handleRetry}
            onEditIntake={handleReset}
          />
        )}
      </main>

      {/* Footer disclaimer — present on every view (§7.3 of the PRD). */}
      <footer className="border-t border-stone-200 bg-stone-50">
        <div className="mx-auto w-full max-w-wide px-5 py-6 sm:px-6">
          <div className="mb-3 flex justify-center">
            <Logo variant="lockup" size={26} />
          </div>
          <p className="mx-auto max-w-xl text-center text-[11px] leading-[1.6] text-stone-500">
            {MEDICAL_DISCLAIMER}
          </p>
        </div>
      </footer>
    </div>
  );
}
