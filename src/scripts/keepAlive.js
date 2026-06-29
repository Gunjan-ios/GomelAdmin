'use strict';

const env = require('../config/env');

async function pingService() {
  const baseUrl = process.env.PING_URL || env.publicBaseUrl;
  
  if (!baseUrl) {
    console.error('❌ Keep-Alive Error: Neither PING_URL nor PUBLIC_BASE_URL is set in environment variables.');
    process.exit(1);
  }

  // Construct target URL
  let targetUrl = baseUrl;
  if (!targetUrl.endsWith('/health') && !targetUrl.endsWith('/health/')) {
    targetUrl = targetUrl.replace(/\/$/, '') + '/health';
  }

  console.log(`⏰ [Keep-Alive] Pinging health check at: ${targetUrl}`);
  const startTime = Date.now();

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Render-KeepAlive-CronJob/1.0',
      },
    });

    const duration = Date.now() - startTime;

    if (response.ok) {
      const data = await response.json().catch(() => ({ status: 'non-json response' }));
      console.log(`✅ [Keep-Alive] Ping successful! Status: ${response.status} (${response.statusText})`);
      console.log(`   Time taken: ${duration}ms`);
      console.log(`   Payload:`, data);
    } else {
      console.error(`⚠️ [Keep-Alive] Ping failed. Status: ${response.status} (${response.statusText})`);
      console.error(`   Time taken: ${duration}ms`);
      process.exit(1);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ [Keep-Alive] Network / connection error after ${duration}ms:`, error.message || error);
    process.exit(1);
  }
}

pingService();
