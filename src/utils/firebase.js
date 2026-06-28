'use strict';

/**
 * Firebase Admin SDK bootstrap for FCM push notifications.
 *
 * Initialisation is LAZY and GUARDED: if the Firebase credentials are not set
 * (env.pushEnabled === false) we never touch firebase-admin, so the server runs
 * exactly as before — push sends become no-ops. Drop the three FIREBASE_* env
 * vars in (see .env.example) to switch real push on without any code change.
 */

const env = require('../config/env');

let messaging = null; // cached admin.messaging() instance once initialised.
let initTried = false;

/** Returns an admin.messaging() instance, or null when push is not configured. */
function getMessaging() {
  if (messaging || initTried) return messaging;
  initTried = true;

  if (!env.pushEnabled) {
    console.log('🔕 Push disabled — FIREBASE_* env vars not set. Skipping FCM init.');
    return null;
  }

  try {
    // Required lazily so the dependency is only loaded when actually used.
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: env.firebaseProjectId,
          clientEmail: env.firebaseClientEmail,
          privateKey: env.firebasePrivateKey,
        }),
      });
    }
    messaging = admin.messaging();
    console.log('🔔 Firebase Admin initialised — push notifications enabled.');
  } catch (err) {
    console.error('⚠️  Firebase Admin init failed; push disabled:', err.message);
    messaging = null;
  }
  return messaging;
}

module.exports = { getMessaging };
