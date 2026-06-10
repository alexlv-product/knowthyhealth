/**
 * server.js — SAD §3.2.1. Express entry point.
 *
 * Wires middleware (JSON 50KB, CORS allowlist, no-store, header hardening),
 * mounts the single route, and registers the global error handler. Exports the
 * app for testing (module.exports = app).
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const adviceController = require('./src/controllers/adviceController');
const adviceStreamController = require('./src/controllers/adviceStreamController');
const { newSupportReference } = require('./src/utils/errors');

const app = express();

// Hide the framework fingerprint (D-18).
app.disable('x-powered-by');

// CORS: frontend origin only (Flag #12). Dev default mirrors Vite's port.
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(
  cors({
    origin: CORS_ORIGIN,
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  })
);

// JSON body parsing, capped at 50KB (API Design §6).
app.use(express.json({ limit: '50kb' }));

// Every response is fresh and uncacheable (D-19).
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Catch malformed JSON / oversized bodies from the parser as VALIDATION_ERROR.
app.use((err, req, res, next) => {
  if (err && (err.type === 'entity.too.large' || err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
    const supportReference = newSupportReference();
    console.info('[advice]', JSON.stringify({ ref: supportReference, status: 400, stage: 'body-parser' }));
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Your request could not be processed. Please check your form and try again.',
      supportReference,
    });
  }
  return next(err);
});

// The one and only route.
app.post('/api/v1/advice', adviceController);

// Streaming variant — same pipeline, Call 2 streamed over SSE for progressive UI.
app.post('/api/v1/advice/stream', adviceStreamController);

// Lightweight health check (handy for platform probes; not part of the contract).
app.get('/healthz', (req, res) => res.status(200).json({ ok: true }));

// Global error handler — anything uncaught becomes a safe INTERNAL_ERROR (D-15/16).
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const supportReference = newSupportReference();
  // Raw error stays in logs only (PRD v1.4 §5.2); the client sees the opaque ref.
  console.error('[unhandled]', JSON.stringify({ ref: supportReference }), err && err.message ? err.message : err);
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred. Please try again.',
    supportReference,
  });
});

// Start only when run directly, so tests can import the app without binding a port.
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`KnowThyHealth API listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
