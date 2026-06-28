'use strict';

/**
 * The single entry point for "tell a user something happened".
 *
 * It does TWO things together so in-app and push always stay in sync:
 *   1. Persists an in-app Notification (shown in the app's bell/inbox).
 *   2. Fires an FCM push to the user's devices (Android + iOS via APNS).
 *
 * Use `notifyUser(userId, {...})` for a single recipient and
 * `notifyBroadcast({...})` for an announcement to everyone (admin broadcast).
 * Push is a no-op when Firebase isn't configured, so these are always safe.
 */

const prisma = require('../db/prisma');
const push = require('./push');

/**
 * @param {string} userId  recipient user id
 * @param {object} opts    { type, title, body, data }
 *   - type:  'booking' | 'reminder' | 'offer' | 'system'
 *   - data:  optional string map carried in the push (e.g. { route, bookingId })
 * @returns the created Notification document
 */
async function notifyUser(userId, { type = 'system', title = '', body = '', data } = {}) {
  const n = await prisma.notification.create({ data: { user: userId, type, title, body } });
  // Don't let a push failure break the request flow.
  push
    .sendToUser(userId, { title, body, type, data, notificationId: n.id })
    .catch((e) => console.error('notifyUser push error:', e.message));
  return n;
}

/** Broadcast to everyone: one stored notification (user=null) + a topic push. */
async function notifyBroadcast({ type = 'system', title = '', body = '', data } = {}) {
  const n = await prisma.notification.create({ data: { user: null, type, title, body } });
  push
    .sendToTopic('all', { title, body, type, data, notificationId: n.id })
    .catch((e) => console.error('notifyBroadcast push error:', e.message));
  return n;
}

module.exports = { notifyUser, notifyBroadcast };
