'use strict';

// Real-time chat over Socket.IO. This sits ON TOP of the existing REST chat
// endpoints — the app still sends via POST /chats/:id/messages and can still
// poll GET .../messages?after= as a fallback. When a socket connection is
// available, new messages are pushed instantly to everyone in the conversation
// room, so the client can stop polling while connected.
//
// Transports are left at the Socket.IO default (websocket + HTTP long-polling),
// so on a host that can't upgrade to WebSockets it still works over long-poll.

const { Server } = require('socket.io');
const { verifyToken } = require('../utils/jwt');
const prisma = require('../db/prisma');
const env = require('../config/env');

let io = null;

const roomFor = (conversationId) => `conv:${conversationId}`;

/** Attach Socket.IO to the given HTTP server. Call once from server.js. */
function init(server) {
  io = new Server(server, {
    cors: {
      origin: env.corsOrigin === '*' ? true : env.corsOrigin.split(','),
      credentials: true,
    },
  });

  // Authenticate every socket with the same JWT the REST API uses. The token
  // is read from the handshake `auth` payload (preferred) or an Authorization
  // header, mirroring middleware/auth.js.
  io.use(async (socket, next) => {
    try {
      const raw =
        (socket.handshake.auth && socket.handshake.auth.token) ||
        (socket.handshake.headers.authorization || '').replace(/^Bearer /, '');
      if (!raw) return next(new Error('Missing auth token'));

      let decoded;
      try {
        decoded = verifyToken(raw);
      } catch (_) {
        return next(new Error('Invalid or expired token'));
      }

      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user) return next(new Error('User no longer exists'));

      socket.data.userId = user.id;
      socket.data.role = user.role;
      next();
    } catch (err) {
      next(new Error('Auth failed'));
    }
  });

  io.on('connection', (socket) => {
    // Join a conversation room after verifying the user may access it. The ack
    // callback lets the client know whether the join succeeded.
    socket.on('conversation:join', async (conversationId, ack) => {
      try {
        const convo = await prisma.conversation.findUnique({ where: { id: conversationId } });
        if (!convo) return ack && ack({ ok: false, error: 'Conversation not found' });

        const allowed =
          socket.data.role === 'admin' ||
          convo.participants.includes(socket.data.userId);
        if (!allowed) return ack && ack({ ok: false, error: 'Forbidden' });

        socket.join(roomFor(conversationId));
        ack && ack({ ok: true });
      } catch (err) {
        ack && ack({ ok: false, error: 'Join failed' });
      }
    });

    socket.on('conversation:leave', (conversationId) => {
      socket.leave(roomFor(conversationId));
    });
  });

  return io;
}

/**
 * Push a freshly-created message to everyone in the conversation room. Each
 * connected viewer gets their own `fromMe` (and the admin's role-based shape)
 * so bubble alignment matches the REST contract exactly. Safe no-op if sockets
 * aren't initialised or nobody is in the room. Best-effort: never throws into
 * the caller (the REST response must succeed regardless).
 */
function emitMessage(conversationId, msg) {
  try {
    if (!io) return;
    const room = io.sockets.adapter.rooms.get(roomFor(conversationId));
    if (!room) return;

    for (const socketId of room) {
      const socket = io.sockets.sockets.get(socketId);
      if (!socket) continue;

      const images = msg.images || [];
      const message =
        socket.data.role === 'admin'
          ? {
              id: msg.id,
              text: msg.text,
              images,
              fromMe: msg.senderRole === 'support' || msg.senderRole === 'system',
              senderRole: msg.senderRole,
              time: msg.time,
            }
          : {
              id: msg.id,
              text: msg.text,
              images,
              fromMe: msg.sender === socket.data.userId,
              system: msg.senderRole === 'system',
              time: msg.time,
            };

      socket.emit('chat:message', { conversationId, message });
    }
  } catch (err) {
    console.error('emitMessage error:', err.message);
  }
}

module.exports = { init, emitMessage };
