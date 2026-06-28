'use strict';

const { verifyToken } = require('../utils/jwt');
const ApiError = require('../utils/ApiError');
const prisma = require('../db/prisma');

/**
 * Requires a valid Bearer token. Loads the user onto req.user.
 * Use for any endpoint that needs a signed-in user (mobile app or admin).
 */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) throw ApiError.unauthorized('Missing auth token');

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (_) {
      throw ApiError.unauthorized('Invalid or expired token');
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) throw ApiError.unauthorized('User no longer exists');

    req.user = user;
    req.auth = decoded;
    next();
  } catch (err) {
    next(err);
  }
}

/** Requires the signed-in user to be an admin. Use AFTER requireAuth. */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return next(ApiError.forbidden('Admin access required'));
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
