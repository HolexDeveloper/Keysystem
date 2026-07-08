/**
 * HolexSS Keysystem 2026 — Backend API
 * Production-ready Express server for Railway deployment.
 *
 * Endpoints:
 *   POST   /Auth/generate  — Internal: register a new key after Work.ink verification
 *   GET    /Auth/verify    — Public: verify any key
 *   GET    /Auth/workink   — Primary: verify Work.ink-gated keys (returns railway_deployment flag)
 *   DELETE /Auth/revoke    — Admin: revoke a key
 *   GET    /Auth/health    — Health check & runtime metrics
 *
 * Environment variables (see .env.example):
 *   PORT              — Port to listen on (Railway sets this automatically)
 *   KEY_PREFIX        — Key prefix, default "HolexSS-"
 *   WORKINK_SLUG      — Your Work.ink slug (for /Auth/workink response)
 *   RAILWAY_ENVIRONMENT — Set automatically by Railway
 *   ADMIN_TOKEN       — Bearer token required for /Auth/revoke (optional but recommended)
 *   CORS_ORIGIN       — Comma-separated allowed origins, default "*"
 */

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config();

const app = express();

/* ─────────────────────────────────────────────────────────────
   Middleware
   ───────────────────────────────────────────────────────────── */
const allowedOrigins = (process.env.CORS_ORIGIN || '*').split(',').map(s => s.trim());
app.use(cors({
  origin: allowedOrigins[0] === '*' ? true : allowedOrigins,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '64kb' }));

// Simple request logger
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()}  ${req.method}  ${req.originalUrl}`);
  next();
});

/* ─────────────────────────────────────────────────────────────
   In-memory store
   Replace with PostgreSQL / Redis for multi-instance deployments.
   ───────────────────────────────────────────────────────────── */
const keys = new Map();

/* ─────────────────────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────────────────────── */
const KEY_PREFIX = process.env.KEY_PREFIX || 'HolexSS-';
const VERSION = '2.4.0';

function generateKey(prefix = KEY_PREFIX) {
  // 4 groups of 4 hex chars = 16 chars total
  const seg = () => crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${prefix}${seg()}-${seg()}-${seg()}-${seg()}`;
}

function isValidKeyFormat(key) {
  if (typeof key !== 'string') return false;
  // HolexSS-XXXX-XXXX-XXXX-XXXX  (XXXX = hex)
  return /^[A-Za-z0-9]+-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/.test(key);
}

function requireAdmin(req, res) {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) return true; // Not configured — allow in dev
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (token !== adminToken) {
    res.status(401).json({ error: 'Unauthorized: admin token required' });
    return false;
  }
  return true;
}

/* ─────────────────────────────────────────────────────────────
   Routes
   ───────────────────────────────────────────────────────────── */

// POST /Auth/generate — Internal endpoint
app.post('/Auth/generate', (req, res) => {
  const { identifier, method = 'workink' } = req.body || {};
  if (!identifier || typeof identifier !== 'string' || identifier.trim().length < 3) {
    return res.status(400).json({ error: 'Missing or invalid identifier (min 3 chars)' });
  }

  const key = generateKey(KEY_PREFIX);
  const record = {
    key,
    identifier: identifier.trim(),
    method,
    generated_at: new Date().toISOString(),
    status: 'active',
  };
  keys.set(key, record);

  return res.status(201).json(record);
});

// GET /Auth/verify — Public verification
app.get('/Auth/verify', (req, res) => {
  const { key } = req.query;
  if (!key) {
    return res.status(400).json({ valid: false, error: 'Missing required parameter: key' });
  }

  const data = keys.get(key);
  if (!data || data.status !== 'active') {
    return res.status(404).json({ valid: false, error: 'Key not found or has been revoked.' });
  }

  return res.json({ valid: true, ...data });
});

// GET /Auth/workink — Work.ink-specific verification (PRIMARY endpoint)
app.get('/Auth/workink', (req, res) => {
  const { key } = req.query;
  if (!key) {
    return res.status(400).json({ valid: false, error: 'Missing required parameter: key' });
  }

  const data = keys.get(key);
  if (!data || data.status !== 'active') {
    return res.status(404).json({ valid: false, error: 'Key not found, expired, or revoked.' });
  }
  if (data.method !== 'workink') {
    return res.status(403).json({ valid: false, error: 'Key verification method mismatch. Expected: workink.' });
  }

  return res.json({
    valid: true,
    verification_method: 'workink',
    railway_deployment: true,
    railway_environment: process.env.RAILWAY_ENVIRONMENT || 'production',
    workink_slug: process.env.WORKINK_SLUG || null,
    ...data,
  });
});

// DELETE /Auth/revoke — Admin revoke
app.delete('/Auth/revoke', (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { key } = req.query;
  if (!key) {
    return res.status(400).json({ error: 'Missing required parameter: key' });
  }

  const data = keys.get(key);
  if (!data) {
    return res.status(404).json({ error: 'Key not found' });
  }

  data.status = 'revoked';
  data.revoked_at = new Date().toISOString();
  keys.set(key, data);

  return res.json({ revoked: true, key, revoked_at: data.revoked_at });
});

// GET /Auth/health — Health check
app.get('/Auth/health', (_req, res) => {
  const activeKeys = [...keys.values()].filter(k => k.status === 'active').length;
  res.json({
    status: 'operational',
    version: VERSION,
    deployment: 'railway',
    railway_environment: process.env.RAILWAY_ENVIRONMENT || 'production',
    key_prefix: KEY_PREFIX,
    total_keys: keys.size,
    active_keys: activeKeys,
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Root — serve the frontend (single-page app)
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API info (kept for /api/ route)
app.get('/api', (_req, res) => {
  res.json({
    name: 'HolexSS Keysystem 2026',
    version: VERSION,
    docs: '/Auth/health',
    endpoints: [
      'POST   /Auth/generate',
      'GET    /Auth/verify',
      'GET    /Auth/workink',
      'DELETE /Auth/revoke',
      'GET    /Auth/health',
    ],
  });
});

// Fallback: serve index.html for any non-API, non-static GET request (SPA support)
app.use((req, res, next) => {
  // Only handle GET requests that aren't API calls
  if (req.method === 'GET' && !req.path.startsWith('/Auth/') && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(__dirname, 'index.html'));
  }
  // For everything else (API calls that didn't match, etc.), return 404 JSON
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
});

/* ─────────────────────────────────────────────────────────────
   Start
   ───────────────────────────────────────────────────────────── */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`╔══════════════════════════════════════════════════════╗`);
  console.log(`║  HolexSS Keysystem ${VERSION}                          ║`);
  console.log(`║  Listening on port ${PORT}                            ║`);
  console.log(`║  Key prefix: ${KEY_PREFIX}                            ║`);
  console.log(`║  Railway env: ${process.env.RAILWAY_ENVIRONMENT || 'local'}                          ║`);
  console.log(`╚══════════════════════════════════════════════════════╝`);
});

module.exports = app;
