# KnowThyHealth — Backend

Stateless Express API for KnowThyHealth — a demographically filtered research
surface. One endpoint, `POST /api/v1/advice`, runs an always-on two-call Claude
flow (intake → readout) plus Tavily retrieval, validates every citation URL
against the live Tavily result set, and returns a structured, evidence-graded
**readout** of recommendation cards grouped by wellness domain. No database, no
sessions, no PII persistence.

Built to: PRD v1.4 · SAD v1.0* · API Design v1.0* · Build Handoff v1.0.
(*SAD and API Design predate v1.4 and need matching revisions; this code is the
implementation reference until then.)

## Requirements
- Node.js 18+ (uses the built-in `fetch`)
- An Anthropic API key and a Tavily API key

## Setup
```bash
cd backend
npm install
cp .env.example .env      # then fill in ANTHROPIC_API_KEY and TAVILY_API_KEY
```

`.env` keys:
| Variable | Purpose | Dev default |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Claude API key | — (required) |
| `TAVILY_API_KEY` | Tavily search key | — (required) |
| `CORS_ORIGIN` | Allowed frontend origin | `http://localhost:5173` |
| `PORT` | HTTP port | `3000` |
| `NODE_ENV` | environment | `development` |

## Run
```bash
npm run dev     # nodemon, auto-reload
# or
npm start       # node server.js
```
Server logs `KnowThyHealth API listening on http://localhost:3000`.

## Verify your keys
```bash
npm run ping:anthropic   # expects { ok: true }
npm run ping:tavily      # expects Results: 3 and a PubMed/NIH URL
```

## Module map (SAD §3.2)
```
server.js                      Express entry: CORS, 50KB JSON, no-store, error handler
src/controllers/adviceController.js   Orchestrates the request flow
src/services/
  intakeProcessor.js           Claude Call 1 — ALWAYS fires: research targets +
                               condition context (degrades on failure)
  citationFetcher.js           Up to 5 parallel Tavily queries, research-target
                               + demographic seeded (never throws)
  adviceGenerator.js           Claude Call 2 — domain-grouped readout (429→429, else→503)
  citationValidator.js         Strips non-Tavily URLs; normalises citation-type
                               pills; downgrades emptied cards to F (no-evidence)
src/utils/
  inputValidator.js            Sanitise + validate + injection check
  promptBuilder.js             Both prompt templates (system prompts static)
  aiHelpers.js                 Text extraction, JSON parse, 429 detection
  errors.js                    ValidationError / RateLimitError / AdviceGenerationError
```

## Notes
- Model string is pinned to `claude-sonnet-4-20250514` per the Build Handoff
  MODEL NOTE.
- Logs record only counts, status, and an opaque support reference — never field
  values or health-condition text (Flag #10 / PRD v1.4 §5.2).
- The raw `healthCondition` text reaches Claude Call 1 (intake) only; it is never
  sent to Tavily, never returned, and never logged (SAD §7.2). Research targets
  derived from it are normalised, not the raw wording.

## v1.4 model (what changed from v1.3)
- Required intake is **gender + age** only; symptoms and lifestyle fields are
  optional refinements (symptoms 0–6). Symptoms act as a lens, not a structure.
- **Call 1 always fires** as intake + research-target identification, not gated
  on a disclosed condition.
- The readout is **domain-grouped** cards of variable count, each carrying
  tier-1/2/3 content and citation-type pills (Meta/RCT/Cohort/Review).
- Grade **F = contradicted/unsupported**; the no-evidence case is distinguished
  in `noEvidenceCaveat` (and is the only F this server auto-assigns).
- Error responses carry an opaque `supportReference`; diagnostics stay in logs.
