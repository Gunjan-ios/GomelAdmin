'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const prisma = require('../db/prisma');
const { notifyUser } = require('../services/notify');
const realtime = require('../realtime/socket');

/** Map a stored message to the app's ChatMessage shape for a given viewer. */
function shape(msg, userId) {
  return {
    id: msg.id,
    text: msg.text,
    images: msg.images || [],
    fromMe: msg.sender === userId,
    // System messages (e.g. "Trip started") belong to neither side and render
    // as a centered divider in the app, not a left/right bubble.
    system: msg.senderRole === 'system',
    time: msg.time,
  };
}

function canAccess(conversation, user) {
  return user.role === 'admin' || conversation.participants.includes(user.id);
}

/** Normalise an images payload to at most 4 non-empty string URLs. */
function sanitizeImages(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map((u) => String(u || '').trim())
    .filter(Boolean)
    .slice(0, 4);
}

function roleFor(conversation, user) {
  if (user.role === 'admin') return 'support';
  if (conversation.type === 'host' && conversation.participants[1] === user.id) return 'host';
  return 'user';
}

/** Count messages in a conversation the given user hasn't read yet. */
function unreadCount(conversationId, userId, since) {
  const where = { conversation: conversationId, sender: { not: userId } };
  if (since) where.time = { gt: since };
  return prisma.message.count({ where });
}

/** Stamp the user's "last read" time for a conversation to now. */
async function touchRead(conversation, userId) {
  const reads = { ...(conversation.reads || {}) };
  reads[String(userId)] = new Date().toISOString();
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { reads },
  });
}

/** GET /chats  -> { data: [conversation summaries] } */
exports.list = asyncHandler(async (req, res) => {
  const convos = await prisma.conversation.findMany({
    where: { participants: { has: req.user.id } },
    orderBy: { lastAt: 'desc' },
  });

  // Resolve the "other" participant of each thread so the list shows who you're
  // talking to — a host sees the customer's name/avatar, a customer sees the
  // host's. (A support thread has no peer; it's always "GoMel Support".)
  const peerIds = convos
    .map((c) => c.participants.find((p) => p !== req.user.id))
    .filter(Boolean);
  const users = await prisma.user.findMany({ where: { id: { in: peerIds } } });
  const byId = {};
  users.forEach((u) => { byId[u.id] = u; });

  // Resolve whether each host thread is currently "closed" (read-only) so the
  // apps can lock the composer once a trip is over. A thread is REUSED across
  // trips for the same customer⇄host(+car) pair, so a single stored bookingId
  // goes stale — after a second booking it may still point at the first,
  // already-completed trip. Instead we look at the customer's bookings for that
  // car and use the NEWEST one's status: an upcoming/ongoing trip keeps the chat
  // open, it closes once that trip is completed, and a fresh booking re-opens
  // it. No booking yet (e.g. messaging a host before booking) stays open.
  const hostConvos = convos.filter((c) => c.type === 'host');
  const closedByConvo = {};
  const statusByConvo = {};
  if (hostConvos.length) {
    const customerIds = [
      ...new Set(hostConvos.map((c) => c.participants[0]).filter(Boolean)),
    ];
    const custBookings = customerIds.length
      ? await prisma.booking.findMany({
          where: { user: { in: customerIds } },
          select: { id: true, status: true, car: true, user: true, createdAt: true },
          orderBy: { createdAt: 'desc' }, // newest first
        })
      : [];
    for (const c of hostConvos) {
      const customerId = String(c.participants[0] || '');
      const carId = String(c.carId || '');
      // This customer's bookings on this conversation's car (newest first).
      const mine = custBookings.filter(
        (b) =>
          String(b.user) === customerId &&
          (!carId || String((b.car && (b.car.id || b.car._id)) || '') === carId)
      );
      let status = '';
      if (mine.length) {
        status = mine[0].status; // newest booking governs the thread
      } else if (c.bookingId) {
        // No car-matched booking (e.g. the thread has no carId) — fall back to
        // the stored bookingId so behaviour is no worse than before.
        const b = custBookings.find((x) => String(x.id) === String(c.bookingId));
        status = b ? b.status : '';
      }
      statusByConvo[c.id] = status;
      closedByConvo[c.id] = status === 'completed';
    }
  }

  const data = await Promise.all(
    convos.map(async (c) => {
      const peerId = c.participants.find((p) => p !== req.user.id);
      const peer = peerId ? byId[peerId] : null;
      const peerName =
        c.type === 'support'
          ? 'GoMel Support'
          : (peer && peer.name) || c.title || 'GoMel';
      const raw = c.reads ? c.reads[String(req.user.id)] : null;
      const since = raw ? new Date(raw) : null;
      const unread = await unreadCount(c.id, req.user.id, since);
      const bookingStatus = statusByConvo[c.id] || '';
      return {
        id: c.id,
        type: c.type,
        title: c.title,
        peerName,
        peerAvatar: (peer && peer.avatarUrl) || '',
        lastMessage: c.lastMessage,
        lastAt: c.lastAt,
        unread,
        bookingId: c.bookingId || '',
        bookingStatus,
        // Trip over -> thread is read-only on both host and customer apps.
        closed: closedByConvo[c.id] || false,
      };
    })
  );
  res.json({ data });
});

/** GET /chats/support  -> { data: conversation }  (finds or creates it) */
exports.support = asyncHandler(async (req, res) => {
  let convo = await prisma.conversation.findFirst({
    where: { type: 'support', participants: { has: req.user.id } },
  });
  if (!convo) {
    convo = await prisma.conversation.create({
      data: {
        type: 'support',
        participants: [req.user.id],
        title: 'GoMel Support',
        lastMessage: 'Hello! 👋 How can we help you today?',
      },
    });
    await prisma.message.create({
      data: {
        conversation: convo.id,
        sender: null,
        senderRole: 'support',
        text: 'Hello! 👋 How can we help you today?',
      },
    });
  }
  res.json({ data: { id: convo.id, type: convo.type, title: convo.title } });
});

/**
 * POST /chats/host  { hostId, hostName?, carId?, bookingId? }
 *   -> { data: conversation }  (finds or creates the chat with a host)
 */
exports.host = asyncHandler(async (req, res) => {
  const hostId = String(req.body.hostId || '').trim();
  if (!hostId) throw ApiError.badRequest('hostId is required');
  if (hostId === req.user.id) throw ApiError.badRequest('Cannot start a chat with yourself');

  const where = {
    type: 'host',
    AND: [
      { participants: { has: req.user.id } },
      { participants: { has: hostId } },
    ],
  };
  if (req.body.carId) where.carId = req.body.carId;

  let convo = await prisma.conversation.findFirst({ where });
  if (!convo) {
    convo = await prisma.conversation.create({
      data: {
        type: 'host',
        participants: [req.user.id, hostId], // [customer, host]
        title: req.body.hostName || 'Host',
        carId: req.body.carId || '',
        bookingId: req.body.bookingId || '',
      },
    });
  }
  res.json({ data: { id: convo.id, type: convo.type, title: convo.title } });
});

/**
 * GET /chats/:id/messages?after=<iso>  -> { data: [ChatMessage] }
 * Pass `after` to poll for only newer messages (shared hosting has no sockets).
 */
exports.messages = asyncHandler(async (req, res) => {
  const convo = await prisma.conversation.findUnique({ where: { id: req.params.id } });
  if (!convo) throw ApiError.notFound('Conversation not found');
  if (!canAccess(convo, req.user)) throw ApiError.forbidden();

  const where = { conversation: convo.id };
  if (req.query.after) {
    const after = new Date(req.query.after);
    if (!isNaN(after.getTime())) where.time = { gt: after };
  }

  const msgs = await prisma.message.findMany({
    where,
    orderBy: { time: 'asc' },
    take: 200,
  });

  // Opening the thread (a non-incremental load) marks it read. Polls pass
  // `after`, so they don't churn the read timestamp on every tick.
  if (!req.query.after) {
    await touchRead(convo, req.user.id).catch(() => {});
  }

  res.json({ data: msgs.map((m) => shape(m, req.user.id)) });
});

/** POST /chats/:id/read  -> { data: { ok: true } }  Mark the thread read. */
exports.markRead = asyncHandler(async (req, res) => {
  const convo = await prisma.conversation.findUnique({ where: { id: req.params.id } });
  if (!convo) throw ApiError.notFound('Conversation not found');
  if (!canAccess(convo, req.user)) throw ApiError.forbidden();
  await touchRead(convo, req.user.id);
  res.json({ data: { ok: true } });
});

/** POST /chats/:id/messages  { text, images? }  -> { data: ChatMessage } */
exports.send = asyncHandler(async (req, res) => {
  const text = String(req.body.text || '').trim();
  const images = sanitizeImages(req.body.images);
  if (!text && !images.length) {
    throw ApiError.badRequest('Message text or an image is required');
  }

  const convo = await prisma.conversation.findUnique({ where: { id: req.params.id } });
  if (!convo) throw ApiError.notFound('Conversation not found');
  if (!canAccess(convo, req.user)) throw ApiError.forbidden();

  const msg = await prisma.message.create({
    data: {
      conversation: convo.id,
      sender: req.user.id,
      senderRole: roleFor(convo, req.user),
      text,
      images,
    },
  });

  const lastMessage =
    text || (images.length === 1 ? '📷 Photo' : `📷 ${images.length} photos`);
  await prisma.conversation.update({
    where: { id: convo.id },
    data: { lastMessage, lastAt: msg.time },
  });

  // Push to anyone watching this conversation over a socket (real-time).
  realtime.emitMessage(convo.id, msg);

  // Nudge the OTHER participant (in-app + push) so they know a new message
  // arrived even if they don't have the chat open. Best effort — a notify
  // failure must not fail the send itself. Support threads are handled by the
  // admin inbox, so only host threads notify here.
  if (convo.type === 'host') {
    const recipientId = convo.participants.find((p) => p !== req.user.id);
    if (recipientId) {
      // Deep-link both directions straight into THIS conversation. The chat
      // route needs the conversation id (to resolve the thread) and a title
      // (the sender is the recipient's peer, so their name is the thread title).
      notifyUser(recipientId, {
        type: 'system',
        title: `${req.user.name || 'New'} sent you a message`,
        body: text || (images.length === 1 ? '📷 Photo' : `📷 ${images.length} photos`),
        data: {
          route: '/chat/host',
          conversationId: String(convo.id),
          title: req.user.name || '',
        },
      }).catch((e) => console.error('chat send notify error:', e.message));
    }
  }

  res.status(201).json({ data: shape(msg, req.user.id) });
});

// ----------------------------------------------------------------------------
// Admin support inbox
//
// The mobile app's support chat (type:'support') is a 1:1 thread between a
// customer and "GoMel Support". These endpoints let an admin see every such
// thread and reply to it. They live here (next to the customer-facing chat
// logic) but are mounted under /admin and gated by requireAdmin.
// ----------------------------------------------------------------------------

/**
 * Shape a stored message for the ADMIN viewer. Unlike the customer `shape`,
 * "mine" isn't decided by sender id (any admin may reply) — it's decided by
 * role: support/system messages sit on the admin's side, the customer's on the
 * other. This keeps the bubble alignment correct regardless of which admin sent
 * which reply.
 */
function shapeForAdmin(msg) {
  return {
    id: msg.id,
    text: msg.text,
    images: msg.images || [],
    fromMe: msg.senderRole === 'support' || msg.senderRole === 'system',
    senderRole: msg.senderRole,
    time: msg.time,
  };
}

/** GET /admin/support  -> { data: [support conversation summaries] } */
exports.adminListSupport = asyncHandler(async (req, res) => {
  const convos = await prisma.conversation.findMany({
    where: { type: 'support' },
    orderBy: { lastAt: 'desc' },
  });

  // The customer is participants[0] for a support thread. Batch-load them so we
  // can show a name/phone in the inbox list instead of a bare id.
  const ids = convos.map((c) => c.participants[0]).filter(Boolean);
  const users = await prisma.user.findMany({ where: { id: { in: ids } } });
  const byId = {};
  users.forEach((u) => { byId[u.id] = u; });

  res.json({
    data: convos.map((c) => {
      const u = byId[c.participants[0]];
      return {
        id: c.id,
        customerId: c.participants[0] || '',
        customerName: (u && u.name) || 'Customer',
        customerPhone: (u && u.phone) || '',
        customerEmail: (u && u.email) || '',
        avatarUrl: (u && u.avatarUrl) || '',
        lastMessage: c.lastMessage,
        lastAt: c.lastAt,
      };
    }),
  });
});

/** GET /admin/support/:id/messages?after=<iso>  -> { data: [ChatMessage] } */
exports.adminMessages = asyncHandler(async (req, res) => {
  const convo = await prisma.conversation.findUnique({ where: { id: req.params.id } });
  if (!convo || convo.type !== 'support') throw ApiError.notFound('Conversation not found');

  const where = { conversation: convo.id };
  if (req.query.after) {
    const after = new Date(req.query.after);
    if (!isNaN(after.getTime())) where.time = { gt: after };
  }

  const msgs = await prisma.message.findMany({
    where,
    orderBy: { time: 'asc' },
    take: 200,
  });
  res.json({ data: msgs.map(shapeForAdmin) });
});

/** POST /admin/support/:id/messages  { text }  -> { data: ChatMessage } */
exports.adminSend = asyncHandler(async (req, res) => {
  const text = String(req.body.text || '').trim();
  if (!text) throw ApiError.badRequest('Message text is required');

  const convo = await prisma.conversation.findUnique({ where: { id: req.params.id } });
  if (!convo || convo.type !== 'support') throw ApiError.notFound('Conversation not found');

  const msg = await prisma.message.create({
    data: {
      conversation: convo.id,
      sender: req.user.id,
      senderRole: 'support',
      text,
    },
  });

  await prisma.conversation.update({
    where: { id: convo.id },
    data: { lastMessage: text, lastAt: msg.time },
  });

  // Push to the customer's socket if they're connected (real-time).
  realtime.emitMessage(convo.id, msg);

  // Nudge the customer (in-app + push) so they know support replied. Best
  // effort — a notify failure must not fail the reply itself.
  const customerId = convo.participants[0];
  if (customerId) {
    notifyUser(customerId, {
      type: 'system',
      title: 'GoMel Support replied',
      body: text.slice(0, 120),
      data: { route: '/chat/support' },
    }).catch((e) => console.error('adminSend notify error:', e.message));
  }

  res.status(201).json({ data: shapeForAdmin(msg) });
});
