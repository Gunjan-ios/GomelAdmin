'use strict';

/**
 * Keep-alive pinger for Render's free tier.
 *
 * Free web services spin down after ~15 min with no inbound traffic, causing a
 * ~10-50s cold start on the next request. To prevent that we hit our own public
 * /health URL on a schedule shorter than that idle window (every 12 min), which
 * registers as inbound traffic and keeps the instance warm.
 *
 * Two ways to run:
 *   - start()                — internal node-cron, called once at server boot.
 *   - `node src/scripts/keepAlive.js` (npm run cron:ping) — single ping, exits
 *     with code 1 on failure so an external scheduler can detect problems.
 *
 * Note: the self-ping only keeps an already-awake instance from sleeping. If the
 * instance ever does sleep (deploy, crash, a >15 min gap), only a real external
 * request — or an external monitor — will wake it.
 */

const cron = require('node-cron');
const env = require('../config/env');

/** Resolve the /health URL to ping, or null if no base URL is configured. */
function resolveTargetUrl() {
  const baseUrl = process.env.PING_URL || env.publicBaseUrl;
  if (!baseUrl) return null;
  // Accept a base ("https://x.onrender.com") or an already-complete /health URL.
  if (/\/health\/?$/.test(baseUrl)) return baseUrl;
  return baseUrl.replace(/\/$/, '') + '/health';
}

/** Fire one /health request. Resolves with timing; rejects on any failure. */
async function pingOnce() {
  const targetUrl = resolveTargetUrl();
  if (!targetUrl) {
    throw new Error('Neither PING_URL nor PUBLIC_BASE_URL is set in environment variables.');
  }
  const startTime = Date.now();
  const response = await fetch(targetUrl, {
    method: 'GET',
    headers: { 'User-Agent': 'Render-KeepAlive-CronJob/1.0' },
  });
  const duration = Date.now() - startTime;
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} (${response.statusText}) after ${duration}ms`);
  }
  return { targetUrl, status: response.status, duration };
}

/**
 * Start the internal keep-alive: ping /health every 12 minutes. No-op (with a
 * warning) when no base URL is configured. Call once at server boot.
 */
function start() {
  const targetUrl = resolveTargetUrl();
  if (!targetUrl) {
    console.warn('   Keep-alive:  disabled (set PING_URL or PUBLIC_BASE_URL to enable)');
    return;
  }
  // Run at minute 0,12,24,36,48 of every hour.
  cron.schedule('*/12 * * * *', async () => {
    try {
      const { duration } = await pingOnce();
      console.log(`✅ [Keep-Alive] ${targetUrl} ok (${duration}ms)`);
    } catch (e) {
      console.error(`⚠️ [Keep-Alive] ping failed: ${e.message}`);
    }
  });
  console.log(`   Keep-alive:  self-ping ${targetUrl} every 12 minutes`);
}

/** Standalone CLI run: one ping, non-zero exit on failure for external cron. */
async function runOnce() {
  console.log('⏰ [Keep-Alive] One-shot ping…');
  try {
    const { targetUrl, status, duration } = await pingOnce();
    console.log(`✅ [Keep-Alive] Ping successful! Status: ${status} for ${targetUrl} (${duration}ms)`);
  } catch (e) {
    console.error(`❌ [Keep-Alive] ${e.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  runOnce();
}

module.exports = { start, pingOnce };
