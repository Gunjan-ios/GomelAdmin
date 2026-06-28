'use strict';

const bcrypt = require('bcryptjs');
const prisma = require('./prisma');

/**
 * Domain helpers that replace the old Mongoose instance/static methods and
 * `toJSON` transforms. With Prisma every row is a plain object, so the
 * id/field shaping the Flutter app expects is done explicitly here.
 */

// ---- User ----------------------------------------------------------------

/**
 * Live subscription view with lazy expiry: an 'active' plan whose expiresAt has
 * passed is reported 'expired' without a cron. null when never subscribed.
 */
function subscriptionView(user) {
  const s = user && user.subscription;
  if (!s || !s.planId || s.status === 'none') return null;
  let status = s.status;
  const exp = s.expiresAt ? new Date(s.expiresAt) : null;
  if (status === 'active' && exp && exp.getTime() < Date.now()) {
    status = 'expired';
  }
  return {
    planId: s.planId,
    status,
    startedAt: s.startedAt,
    expiresAt: s.expiresAt,
  };
}

/** The exact shape the Flutter `UserProfile.fromJson` expects. */
function toProfile(user) {
  const kyc = user.kyc || null;
  return {
    name: user.name,
    phone: user.phone,
    email: user.email,
    avatarUrl: user.avatarUrl,
    licenseStatus: user.licenseStatus,
    walletBalance: user.walletBalance,
    upiId: user.upiId,
    subscription: subscriptionView(user),
    // Driving-license details so the app can show the uploaded photos and
    // number after submission. null until the user submits KYC.
    kyc: kyc && {
      licenseNumber: kyc.licenseNumber || '',
      frontImage: kyc.frontImage || '',
      backImage: kyc.backImage || '',
    },
  };
}

/** Public user JSON: expose `id`, hide internal/secret fields. */
function serializeUser(user) {
  if (!user) return user;
  const { passwordHash, deviceTokens, ...rest } = user;
  return rest;
}

function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

function comparePassword(user, plain) {
  if (!user || !user.passwordHash) return Promise.resolve(false);
  return bcrypt.compare(plain, user.passwordHash);
}

// ---- Booking -------------------------------------------------------------

/** Booking JSON for the app: drop server-only fields. */
function serializeBooking(b) {
  if (!b) return b;
  const { user, createdAt, updatedAt, ...rest } = b;
  return rest;
}

// ---- Notification --------------------------------------------------------

function serializeNotification(n) {
  if (!n) return n;
  const { user, ...rest } = n;
  return rest;
}

// ---- Setting -------------------------------------------------------------

/** Fetch the singleton settings row, creating it on first access. */
async function getSettings() {
  return prisma.setting.upsert({
    where: { id: 'app' },
    update: {},
    create: { id: 'app' },
  });
}

module.exports = {
  subscriptionView,
  toProfile,
  serializeUser,
  serializeBooking,
  serializeNotification,
  hashPassword,
  comparePassword,
  getSettings,
};
