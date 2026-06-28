'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const prisma = require('../db/prisma');
const {
  subscriptionView,
  toProfile,
  serializeNotification,
  getSettings,
} = require('../db/helpers');

// ---------------- App status ----------------

/**
 * GET /status  -> { data: { maintenanceMode, maintenanceMessage } }  (public)
 * The customer & host apps poll this on launch; when maintenanceMode is true
 * they show a full-screen maintenance page instead of the normal app.
 */
exports.status = asyncHandler(async (req, res) => {
  const s = await getSettings();
  res.json({
    data: {
      maintenanceMode: s.maintenanceMode,
      maintenanceMessage: s.maintenanceMessage,
    },
  });
});

// ---------------- Notifications ----------------

/** GET /notifications  -> { data: [Notification] } (user + broadcasts) */
exports.listNotifications = asyncHandler(async (req, res) => {
  const data = await prisma.notification.findMany({
    where: { OR: [{ user: req.user.id }, { user: null }] },
    orderBy: { date: 'desc' },
  });
  res.json({ data: data.map(serializeNotification) });
});

/** PATCH /notifications/:id/read -> { data: Notification } */
exports.markNotificationRead = asyncHandler(async (req, res) => {
  const existing = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound('Notification not found');
  const n = await prisma.notification.update({
    where: { id: existing.id },
    data: { read: true },
  });
  res.json({ data: serializeNotification(n) });
});

/** DELETE /notifications/:id -> { data: { ok: true } } */
exports.deleteNotification = asyncHandler(async (req, res) => {
  const existing = await prisma.notification.findUnique({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound('Notification not found');
  // Broadcasts (user: null) are shared across all users and not deletable per-user.
  if (existing.user !== req.user.id) {
    throw ApiError.forbidden('Cannot delete this notification');
  }
  await prisma.notification.delete({ where: { id: existing.id } });
  res.json({ data: { ok: true } });
});

/** DELETE /notifications -> { data: { count } }  (clears the user's own notifications) */
exports.clearNotifications = asyncHandler(async (req, res) => {
  const result = await prisma.notification.deleteMany({ where: { user: req.user.id } });
  res.json({ data: { count: result.count } });
});

// ---------------- Subscriptions ----------------

/** GET /subscriptions  -> { data: [SubscriptionPlan] } (public) */
exports.listPlans = asyncHandler(async (req, res) => {
  const data = await prisma.subscriptionPlan.findMany({ orderBy: { monthlyPrice: 'asc' } });
  res.json({ data });
});

/**
 * GET /subscriptions/me -> { data: UserSubscription | null }  (auth)
 * The caller's current membership (with lazy expiry applied), or null.
 */
exports.mySubscription = asyncHandler(async (req, res) => {
  res.json({ data: subscriptionView(req.user) });
});

/**
 * POST /subscriptions/cancel -> { data: UserSubscription | null }  (auth)
 * Cancels the active membership. Option A is a one-time monthly charge, so there
 * is nothing to stop billing — we simply mark it cancelled (no refund).
 */
exports.cancelSubscription = asyncHandler(async (req, res) => {
  const user = req.user;
  if (user.subscription && user.subscription.status === 'active') {
    // subscription is a JSON column: read-modify-write the whole object.
    const subscription = { ...user.subscription, status: 'cancelled' };
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { subscription },
    });
    return res.json({ data: subscriptionView(updated) });
  }
  res.json({ data: subscriptionView(user) });
});

// ---------------- Damage claims ----------------

/** GET /claims  -> { data: [DamageClaim] } */
exports.listClaims = asyncHandler(async (req, res) => {
  const data = await prisma.damageClaim.findMany({
    where: { user: req.user.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data });
});

/** POST /claims  { bookingId, carName, severity, description, ... } */
exports.createClaim = asyncHandler(async (req, res) => {
  const claim = await prisma.damageClaim.create({
    data: {
      bookingId: req.body.bookingId || '',
      carName: req.body.carName || '',
      severity: req.body.severity || 'minor',
      description: req.body.description || '',
      photosCaptured: req.body.photosCaptured || 0,
      photos: req.body.photos || [],
      insurer: req.body.insurer || '',
      processingFee: req.body.processingFee || 0,
      user: req.user.id,
    },
  });
  res.status(201).json({ data: claim });
});

// ---------------- Inspections ----------------

/** POST /inspections  { bookingId, type, fuelLevel, odometer, notes, ... } */
exports.createInspection = asyncHandler(async (req, res) => {
  if (!req.body.bookingId || !req.body.type) {
    throw ApiError.badRequest('bookingId and type are required');
  }
  const record = await prisma.inspection.create({
    data: {
      bookingId: req.body.bookingId,
      type: req.body.type,
      fuelLevel: req.body.fuelLevel || 0,
      odometer: req.body.odometer || 0,
      photosCaptured: req.body.photosCaptured || 0,
      photos: req.body.photos || [],
      notes: req.body.notes || '',
      at: req.body.at ? new Date(req.body.at) : new Date(),
      user: req.user.id,
    },
  });
  res.status(201).json({ data: record });
});

// ---------------- KYC ----------------

/** POST /kyc  { licenseNumber, frontImage, backImage } -> { user } */
exports.submitKyc = asyncHandler(async (req, res) => {
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      kyc: {
        licenseNumber: req.body.licenseNumber || '',
        frontImage: req.body.frontImage || '',
        backImage: req.body.backImage || '',
      },
      licenseStatus: 'pending',
    },
  });
  res.json({ user: toProfile(user) });
});

// ---------------- Uploads ----------------

/** POST /uploads  (multipart, field "file")  -> { url } */
exports.upload = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file uploaded (field name: file)');
  // Prefer an explicit PUBLIC_BASE_URL; otherwise derive from how the client
  // reached us so the URL works from the app's host (not localhost). Honour the
  // X-Forwarded-* headers set by a reverse proxy.
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const base = env.publicBaseUrl || `${proto}://${host}`;
  const url = `${base.replace(/\/$/, '')}/uploads/${req.file.filename}`;
  res.status(201).json({ url });
});
