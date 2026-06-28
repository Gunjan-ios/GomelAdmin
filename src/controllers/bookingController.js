'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { pageParams, pageMeta } = require('../utils/paginate');
const { genOtp } = require('../utils/id');
const prisma = require('../db/prisma');
const { serializeBooking } = require('../db/helpers');
const { onBookingCompleted } = require('../services/rewards');
const { notifyUser } = require('../services/notify');
const realtime = require('../realtime/socket');

/** Resolve the host (owner) user id for a booking's embedded car, or null. */
async function hostIdForBooking(booking) {
  const carId = booking.car && (booking.car.id || booking.car._id);
  if (!carId) return null;
  const car = await prisma.car.findUnique({
    where: { id: carId },
    select: { ownerId: true },
  });
  return car ? car.ownerId : null;
}

/**
 * GET /bookings?page=&limit=  (current user's bookings)
 *   -> { data: [Booking] }                                  (no page param)
 *   -> { data: [Booking], page, limit, total, hasMore }     (paginated)
 */
exports.list = asyncHandler(async (req, res) => {
  const where = { user: req.user.id };
  const orderBy = { createdAt: 'desc' };
  const pg = pageParams(req);
  if (!pg) {
    const bookings = await prisma.booking.findMany({ where, orderBy });
    return res.json({ data: bookings.map(serializeBooking) });
  }

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({ where, orderBy, skip: pg.skip, take: pg.limit }),
    prisma.booking.count({ where }),
  ]);
  res.json({ data: bookings.map(serializeBooking), ...pageMeta(pg, total) });
});

/**
 * POST /bookings  { car, start, end, package, fare }  -> { data: Booking }
 * The server owns id, unlockOtp and the initial status for integrity.
 */
exports.create = asyncHandler(async (req, res) => {
  const { car, start, end, fare } = req.body;
  if (!car || !start || !end) {
    throw ApiError.badRequest('car, start and end are required');
  }

  const booking = await prisma.booking.create({
    data: {
      car,
      start: new Date(start),
      end: new Date(end),
      package: req.body.package || 'daily',
      fare: fare || {},
      status: 'upcoming',
      unlockOtp: genOtp(4),
      tripStarted: false,
      isVerifiedByHost: false,
      user: req.user.id,
    },
  });

  const carName = car.name || 'car';

  // Customer: confirmation.
  await notifyUser(req.user.id, {
    type: 'booking',
    title: 'Booking confirmed',
    body: `Your ${carName} is reserved. Booking #${booking.id}.`,
    data: { route: '/trips', bookingId: booking.id },
  });

  // Host: a new booking came in for their car.
  const hostId = await hostIdForBooking(booking);
  if (hostId && hostId !== req.user.id) {
    await notifyUser(hostId, {
      type: 'booking',
      title: 'New booking! 🎉',
      body: `${carName} was just booked. Booking #${booking.id}.`,
      data: { route: '/host', bookingId: booking.id },
    });
  }

  res.status(201).json({ data: serializeBooking(booking) });
});

/**
 * PATCH /bookings/:id  { status, tripStarted, isVerifiedByHost }
 *   -> { data: Booking }
 */
exports.update = asyncHandler(async (req, res) => {
  const existing = await prisma.booking.findUnique({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound('Booking not found');

  // Authorize: the booking's customer, or the host who owns the booking's car.
  // The host needs to flip isVerifiedByHost when confirming the trip handoff,
  // so this can't be scoped to the booking's `user` (that's the customer).
  const hostId = await hostIdForBooking(existing);
  const isCustomer = String(existing.user) === String(req.user.id);
  const isHost = hostId && String(hostId) === String(req.user.id);
  if (!isCustomer && !isHost) throw ApiError.notFound('Booking not found');

  const prevStatus = existing.status;

  // Host "customer no-show" cancellation: only the host may invoke it, and only
  // after waiting an hour past pickup for a trip the renter never started.
  const isNoShow = req.body.reason === 'no_show' && req.body.status === 'cancelled';
  if (isNoShow) {
    if (!isHost) {
      throw ApiError.forbidden('Only the host can mark a customer no-show.');
    }
    if (existing.tripStarted || existing.status !== 'upcoming') {
      throw ApiError.badRequest('This trip has already started — it cannot be marked a no-show.');
    }
    const canCancelAt = new Date(existing.start).getTime() + 60 * 60 * 1000;
    if (Date.now() < canCancelAt) {
      throw ApiError.badRequest('You can only cancel a no-show 1 hour after the pickup time.');
    }
  }

  const data = {};
  if (req.body.status !== undefined) data.status = req.body.status;
  if (req.body.tripStarted !== undefined) data.tripStarted = req.body.tripStarted;
  if (req.body.isVerifiedByHost !== undefined) {
    data.isVerifiedByHost = req.body.isVerifiedByHost;
  }

  const booking = await prisma.booking.update({ where: { id: existing.id }, data });

  const statusChanged = req.body.status !== undefined && booking.status !== prevStatus;
  if (statusChanged) {
    await notifyBookingStatusChange(booking, booking.user, { noShow: isNoShow });
  }

  // On trip completion: award loyalty points + settle any pending referral.
  if (prevStatus !== 'completed' && booking.status === 'completed') {
    await onBookingCompleted(booking);
  }

  res.json({ data: serializeBooking(booking) });
});

/** Push the right messages to customer + host when a booking changes status. */
async function notifyBookingStatusChange(booking, customerId, { noShow = false } = {}) {
  const carName = (booking.car && booking.car.name) || 'your car';
  const hostId = await hostIdForBooking(booking);
  const notifyHost = (opts) => {
    if (hostId && hostId !== customerId) return notifyUser(hostId, opts);
  };

  switch (booking.status) {
    case 'ongoing':
      await notifyUser(customerId, {
        type: 'booking',
        title: 'Trip started ✓',
        body: `Your ${carName} trip has begun. Drive safe!`,
        data: { route: '/trips', bookingId: booking.id },
      });
      await notifyHost({
        type: 'booking',
        title: 'Customer started the trip',
        body: `The renter has picked up ${carName}.`,
        data: { route: '/host', bookingId: booking.id },
      });
      // Drop a centered "Trip started" marker into the host⇄customer chat so
      // both sides have a clear in-thread boundary for the trip.
      await postChatSystemMessage(booking, customerId, hostId, 'Trip started');
      break;
    case 'completed':
      await notifyUser(customerId, {
        type: 'booking',
        title: 'Trip completed 🏁',
        body: `Thanks for driving ${carName}. Tap to rate your trip.`,
        data: { route: '/trips', bookingId: booking.id },
      });
      await notifyHost({
        type: 'booking',
        title: 'Car returned',
        body: `${carName} was returned. Review and verify the handover.`,
        data: { route: '/host', bookingId: booking.id },
      });
      break;
    case 'cancelled':
      await notifyUser(customerId, {
        type: 'booking',
        title: noShow ? 'Booking cancelled — no-show' : 'Booking cancelled',
        body: noShow
          ? `You didn't pick up ${carName} within an hour of your slot, so the host cancelled booking #${booking.id}. Your security deposit will be refunded.`
          : `Your booking #${booking.id} for ${carName} was cancelled.`,
        data: { route: '/trips', bookingId: booking.id },
      });
      await notifyHost({
        type: 'booking',
        title: noShow ? 'No-show cancelled' : 'Booking cancelled',
        body: noShow
          ? `You cancelled the no-show booking for ${carName}. The dates are free again.`
          : `A booking for ${carName} was cancelled. The dates are free again.`,
        data: { route: '/host', bookingId: booking.id },
      });
      break;
    default:
      break;
  }
}

/**
 * Post a system message (e.g. "Trip started") into the host⇄customer chat for a
 * booking. System messages have no sender and render as a centered divider in
 * the apps. Best-effort: a failure here must never fail the booking update.
 *
 * Finds the existing host thread (by bookingId, else by the customer+host pair)
 * and creates one if none exists yet, so both parties see the marker whenever
 * they open the chat. Skips silently if the host can't be resolved or the same
 * marker was already posted (so a repeated status PATCH doesn't duplicate it).
 */
async function postChatSystemMessage(booking, customerId, hostId, text) {
  try {
    if (!hostId || String(hostId) === String(customerId)) return;
    const carId = (booking.car && (booking.car.id || booking.car._id)) || '';

    let convo = await prisma.conversation.findFirst({
      where: { type: 'host', bookingId: String(booking.id) },
    });
    if (!convo) {
      convo = await prisma.conversation.findFirst({
        where: {
          type: 'host',
          AND: [
            { participants: { has: String(customerId) } },
            { participants: { has: String(hostId) } },
          ],
        },
      });
    }
    if (!convo) {
      convo = await prisma.conversation.create({
        data: {
          type: 'host',
          participants: [String(customerId), String(hostId)], // [customer, host]
          title: (booking.car && booking.car.name) || 'Host',
          carId: carId ? String(carId) : '',
          bookingId: String(booking.id),
        },
      });
    } else if (convo.bookingId !== String(booking.id)) {
      // The thread is reused across trips for the same customer⇄host pair, so a
      // found conversation may still point at a PREVIOUS (often completed)
      // booking. Re-point it at the current trip's booking; otherwise the inbox
      // reports `closed: true` (status of the old, completed booking) and locks
      // the composer to read-only even though a new trip just started.
      convo = await prisma.conversation.update({
        where: { id: convo.id },
        data: { bookingId: String(booking.id) },
      });
    }

    // Don't post the same marker twice (e.g. a duplicate status PATCH).
    const dupe = await prisma.message.findFirst({
      where: { conversation: convo.id, senderRole: 'system', text },
    });
    if (dupe) return;

    const msg = await prisma.message.create({
      data: {
        conversation: convo.id,
        sender: null,
        senderRole: 'system',
        text,
      },
    });
    await prisma.conversation.update({
      where: { id: convo.id },
      data: { lastMessage: text, lastAt: msg.time },
    });
    realtime.emitMessage(convo.id, msg);
  } catch (e) {
    console.error('postChatSystemMessage error:', e.message);
  }
}
