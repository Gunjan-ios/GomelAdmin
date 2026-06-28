'use strict';

const crypto = require('crypto');

/** Generate a short, readable, prefixed id (e.g. "car_a1b2c3d4e5f6"). */
function genId(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

/** Booking ids look like "BK9F3A2C". */
function genBookingId() {
  return `BK${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

/** A numeric OTP of the given length (default 4 to match the app). */
function genOtp(length = 4) {
  let s = '';
  for (let i = 0; i < length; i++) s += Math.floor(crypto.randomInt(0, 10));
  return s;
}

/**
 * Referral code like "JOHN500" — first word of the name (A-Z only) padded to
 * 4 chars, plus 3 digits. Falls back to "GOMEL" when there's no usable name.
 */
function genReferralCode(name = '') {
  const base = String(name).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) || 'GOMEL';
  const num = String(crypto.randomInt(100, 1000));
  return `${base}${num}`;
}

module.exports = { genId, genBookingId, genOtp, genReferralCode };
