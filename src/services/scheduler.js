'use strict';

/**
 * Time-based booking reminders.
 *
 * There is no event that fires "1 hour before pickup", so a lightweight cron
 * polls every minute and pushes:
 *   - "Trip starts in 1 hour"  to the renter + host, once per booking
 *   - "Trip ends in 1 hour"    to the renter + host, once per booking
 *
 * Each reminder is guarded by a persisted flag on the booking
 * (startReminderSent / endReminderSent) so a booking is only ever notified
 * once, even though the poll runs 60×/hour and across restarts.
 *
 * The whole thing is best-effort: any error is logged and swallowed so a bad
 * tick never crashes the API process.
 */

const cron = require('node-cron');
const prisma = require('../db/prisma');
const { notifyUser } = require('./notify');

const ONE_HOUR_MS = 60 * 60 * 1000;

/** Map booking car ids -> owner (host) user id in a single query. */
async function hostIdsForBookings(bookings) {
  const carIds = [
    ...new Set(
      bookings
        .map((b) => b.car && (b.car.id || b.car._id))
        .filter(Boolean)
        .map(String)
    ),
  ];
  if (!carIds.length) return new Map();
  const cars = await prisma.car.findMany({
    where: { id: { in: carIds } },
    select: { id: true, ownerId: true },
  });
  return new Map(cars.map((c) => [String(c.id), c.ownerId]));
}

/** Notify both the renter and (if different) the host for one booking. */
async function notifyBoth(booking, hostId, { title, body, route }) {
  await notifyUser(booking.user, {
    type: 'reminder',
    title,
    body,
    data: { route: '/trips', bookingId: booking.id },
  });
  if (hostId && String(hostId) !== String(booking.user)) {
    await notifyUser(hostId, {
      type: 'reminder',
      title,
      body,
      data: { route: '/host', bookingId: booking.id },
    });
  }
}

/** Send the "starts in 1 hour" reminder for any booking entering that window. */
async function runStartReminders(now) {
  const windowEnd = new Date(now.getTime() + ONE_HOUR_MS);
  const due = await prisma.booking.findMany({
    where: {
      status: 'upcoming',
      startReminderSent: false,
      start: { gt: now, lte: windowEnd },
    },
  });
  if (!due.length) return 0;

  const hosts = await hostIdsForBookings(due);
  for (const b of due) {
    const carName = (b.car && b.car.name) || 'your car';
    const hostId = hosts.get(String(b.car && (b.car.id || b.car._id)));
    try {
      await notifyBoth(b, hostId, {
        title: 'Trip starts in 1 hour ⏰',
        body: `Your ${carName} pickup is coming up. Get ready!`,
      });
      await prisma.booking.update({
        where: { id: b.id },
        data: { startReminderSent: true },
      });
    } catch (e) {
      console.error('start reminder failed for booking', b.id, e.message);
    }
  }
  return due.length;
}

/** Send the "ends in 1 hour" reminder for any active booking nearing drop-off. */
async function runEndReminders(now) {
  const windowEnd = new Date(now.getTime() + ONE_HOUR_MS);
  const due = await prisma.booking.findMany({
    where: {
      status: 'ongoing',
      endReminderSent: false,
      end: { gt: now, lte: windowEnd },
    },
  });
  if (!due.length) return 0;

  const hosts = await hostIdsForBookings(due);
  for (const b of due) {
    const carName = (b.car && b.car.name) || 'your car';
    const hostId = hosts.get(String(b.car && (b.car.id || b.car._id)));
    try {
      await notifyBoth(b, hostId, {
        title: 'Trip ends in 1 hour 🏁',
        body: `Time to wrap up your ${carName} trip and head to drop-off.`,
      });
      await prisma.booking.update({
        where: { id: b.id },
        data: { endReminderSent: true },
      });
    } catch (e) {
      console.error('end reminder failed for booking', b.id, e.message);
    }
  }
  return due.length;
}

let running = false;

/** One poll tick. Guarded so overlapping ticks (slow DB) can't pile up. */
async function tick() {
  if (running) return;
  running = true;
  try {
    const now = new Date();
    await runStartReminders(now);
    await runEndReminders(now);
  } catch (e) {
    console.error('reminder scheduler tick error:', e.message);
  } finally {
    running = false;
  }
}

/** Start the every-minute reminder poll. Call once at server boot. */
function start() {
  cron.schedule('* * * * *', tick);
  console.log('   Scheduler:   booking reminders every minute');
}

module.exports = { start, tick };
