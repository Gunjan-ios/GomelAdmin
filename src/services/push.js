'use strict';

/**
 * Push delivery via Firebase Cloud Messaging (FCM).
 *
 * FCM handles BOTH platforms from one call: Android devices receive directly,
 * and iOS devices receive through APNS (FCM relays to Apple using the APNS auth
 * key you upload in the Firebase console). The app stores its device token on
 * the User (see models/User.js `deviceTokens`) via POST /auth/device-token.
 *
 * Every function here is safe to call when push is NOT configured — it simply
 * does nothing. So callers never need to guard with `if (pushEnabled)`.
 */

const { getMessaging } = require('../utils/firebase');
const prisma = require('../db/prisma');

/** Build the data map FCM carries. All values must be strings. */
function buildData({ type, notificationId, data }) {
  const out = {};
  if (type) out.type = String(type);
  if (notificationId) out.notificationId = String(notificationId);
  // A `route` lets the app deep-link on tap (e.g. "/notifications").
  for (const [k, v] of Object.entries(data || {})) {
    if (v !== undefined && v !== null) out[k] = String(v);
  }
  return out;
}

/**
 * Send a push to one user across all of their registered devices.
 * Invalid/expired tokens reported by FCM are pruned from the user document.
 */
async function sendToUser(userId, { title, body, type, data, notificationId } = {}) {
  const messaging = getMessaging();
  if (!messaging || !userId) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { deviceTokens: true },
  });
  const tokens = (user?.deviceTokens || []).map((d) => d.token).filter(Boolean);
  if (!tokens.length) return;

  const message = {
    tokens,
    notification: { title: title || '', body: body || '' },
    data: buildData({ type, notificationId, data }),
    android: { priority: 'high', notification: { channelId: 'high_importance_channel' } },
    apns: { payload: { aps: { sound: 'default', badge: 1 } } },
  };

  try {
    const res = await messaging.sendEachForMulticast(message);
    await pruneInvalidTokens(userId, tokens, res);
  } catch (err) {
    console.error('Push sendToUser failed:', err.message);
  }
}

/** Remove tokens FCM reports as unregistered/invalid so we stop sending to dead devices. */
async function pruneInvalidTokens(userId, tokens, res) {
  if (!res || !res.responses) return;
  const dead = [];
  res.responses.forEach((r, i) => {
    const code = r.error && r.error.code;
    if (
      code === 'messaging/registration-token-not-registered' ||
      code === 'messaging/invalid-registration-token' ||
      code === 'messaging/invalid-argument'
    ) {
      dead.push(tokens[i]);
    }
  });
  if (dead.length) {
    // No $pull in Prisma: read the deviceTokens JSON, drop the dead ones in JS,
    // then write the whole array back.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { deviceTokens: true },
    });
    if (user) {
      const deadSet = new Set(dead);
      const remaining = (user.deviceTokens || []).filter((d) => !deadSet.has(d.token));
      await prisma.user.update({
        where: { id: userId },
        data: { deviceTokens: remaining },
      });
    }
  }
}

/**
 * Broadcast to every device subscribed to the "all" topic. The app subscribes
 * on launch (see PushNotificationService), so admin broadcasts reach everyone.
 */
async function sendToTopic(topic, { title, body, type, data, notificationId } = {}) {
  const messaging = getMessaging();
  if (!messaging) return;
  try {
    await messaging.send({
      topic,
      notification: { title: title || '', body: body || '' },
      data: buildData({ type, notificationId, data }),
      android: { priority: 'high', notification: { channelId: 'high_importance_channel' } },
      apns: { payload: { aps: { sound: 'default' } } },
    });
  } catch (err) {
    console.error('Push sendToTopic failed:', err.message);
  }
}

module.exports = { sendToUser, sendToTopic };
