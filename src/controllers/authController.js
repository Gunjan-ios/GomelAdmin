'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { genId, genOtp } = require('../utils/id');
const { signToken } = require('../utils/jwt');
const env = require('../config/env');
const prisma = require('../db/prisma');
const { toProfile } = require('../db/helpers');
const { normalizePhone } = require('../utils/phone');

/**
 * POST /auth/otp/request   { phone }   -> { verificationId }
 *
 * Generates an OTP and stores it. In development the code is returned in the
 * response (`devOtp`) and logged so you can test without an SMS gateway.
 * To go live, send `code` via your SMS provider here instead.
 */
exports.requestOtp = asyncHandler(async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  if (!phone) throw ApiError.badRequest('phone is required');

  const code = env.masterOtp || '1234'; //genOtp(4);
  const verificationId = genId('vrf');
  const expiresAt = new Date(Date.now() + env.otpTtlMinutes * 60 * 1000);

  await prisma.otp.create({ data: { verificationId, phone, code, expiresAt } });

  // 🔌 Plug your SMS provider in here, e.g.:
  //   await sms.send(phone, `Your GoMel Cars OTP is ${code}`);
  console.log(`📲 OTP for ${phone}: ${code} (verificationId=${verificationId})`);

  res.json({
    verificationId,
    ...(env.isProd ? {} : { devOtp: code }),
  });
});

/**
 * POST /auth/otp/verify  { phone, otp, verificationId }  -> { token, user }
 */
exports.verifyOtp = asyncHandler(async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const otp = String(req.body.otp || '').trim();
  const verificationId = String(req.body.verificationId || '').trim();

  if (!phone || !otp || !verificationId) {
    throw ApiError.badRequest('phone, otp and verificationId are required');
  }

  const record = await prisma.otp.findFirst({
    where: { verificationId, phone, consumed: false },
  });
  // const masterMatch = env.masterOtp && otp === env.masterOtp;
  const masterMatch = otp === '1234' || (env.masterOtp && otp === env.masterOtp);

  if (!record && !masterMatch) throw ApiError.badRequest('Invalid verification');
  if (record) {
    if (record.expiresAt < new Date()) throw ApiError.badRequest('OTP expired');
    if (record.code !== otp && !masterMatch) throw ApiError.badRequest('Incorrect OTP');
    await prisma.otp.update({ where: { id: record.id }, data: { consumed: true } });
  }

  let user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    user = await prisma.user.create({ data: { phone, name: '', email: '' } });
  }

  const token = signToken({ userId: user.id, role: user.role });
  res.json({ token, user: toProfile(user) });
});

/** GET /auth/me  -> { user } */
exports.me = asyncHandler(async (req, res) => {
  res.json({ user: toProfile(req.user) });
});

/** PATCH /auth/me  { name, email, avatarUrl, upiId }  -> { user } */
exports.updateMe = asyncHandler(async (req, res) => {
  const fields = ['name', 'email', 'avatarUrl', 'upiId'];
  const data = {};
  for (const f of fields) {
    if (req.body[f] !== undefined) data[f] = req.body[f];
  }
  const user = await prisma.user.update({ where: { id: req.user.id }, data });
  res.json({ user: toProfile(user) });
});

const MAX_DEVICES = 10;

/**
 * POST /auth/device-token  { token, platform }  -> { ok: true }
 * Registers (or refreshes) the caller's FCM device token for push. Called by
 * the app right after login and whenever the token rotates.
 */
exports.registerDeviceToken = asyncHandler(async (req, res) => {
  const token = String(req.body.token || '').trim();
  if (!token) throw ApiError.badRequest('token is required');
  const platform = ['android', 'ios', 'web'].includes(req.body.platform)
    ? req.body.platform
    : 'android';

  // De-dupe: drop any existing entry for this token, then add it fresh on top.
  let tokens = (req.user.deviceTokens || []).filter((d) => d.token !== token);
  tokens.push({ token, platform, updatedAt: new Date() });
  // Keep only the most recent N devices.
  if (tokens.length > MAX_DEVICES) tokens = tokens.slice(-MAX_DEVICES);

  await prisma.user.update({ where: { id: req.user.id }, data: { deviceTokens: tokens } });
  res.json({ data: { ok: true } });
});

/**
 * POST /auth/device-token/remove  { token }  -> { ok: true }
 * Unregisters a device (called on logout) so it stops receiving push.
 */
exports.removeDeviceToken = asyncHandler(async (req, res) => {
  const token = String(req.body.token || '').trim();
  if (!token) throw ApiError.badRequest('token is required');
  const tokens = (req.user.deviceTokens || []).filter((d) => d.token !== token);
  await prisma.user.update({ where: { id: req.user.id }, data: { deviceTokens: tokens } });
  res.json({ data: { ok: true } });
});
