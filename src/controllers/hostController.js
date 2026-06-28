'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { pageParams, pageMeta } = require('../utils/paginate');
const business = require('../config/business');
const prisma = require('../db/prisma');
const { toProfile } = require('../db/helpers');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const hostShare = (base) => Math.round((base || 0) * (1 - business.platformCommissionRate));

function dateRange(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  if (s.getMonth() === e.getMonth()) return `${s.getDate()}–${e.getDate()} ${MONTHS[s.getMonth()]}`;
  return `${s.getDate()} ${MONTHS[s.getMonth()]} – ${e.getDate()} ${MONTHS[e.getMonth()]}`;
}
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

/**
 * Bookings whose embedded car.id is one of the given car ids. Booking.car is a
 * JSON column (no relation), so we load the rows and filter in JS — mirroring
 * the old `Booking.find({ 'car.id': { $in: carIds } })`.
 */
async function bookingsForCars(carIds, { orderByCreatedDesc = true, carName } = {}) {
  if (!carIds.length) return [];
  const idSet = new Set(carIds.map(String));
  let rows = await prisma.booking.findMany(
    orderByCreatedDesc ? { orderBy: { createdAt: 'desc' } } : {},
  );
  rows = rows.filter((b) => b.car && idSet.has(String(b.car.id)));
  if (carName !== undefined) rows = rows.filter((b) => b.car && b.car.name === carName);
  return rows;
}

// ---------------- Become a host ----------------

/** POST /host/become  -> { user }  (upgrades the current account to host) */
exports.become = asyncHandler(async (req, res) => {
  const data = {};
  if (req.user.role === 'user') data.role = 'host';
  if (req.body.upiId !== undefined) data.upiId = req.body.upiId;
  const user = Object.keys(data).length
    ? await prisma.user.update({ where: { id: req.user.id }, data })
    : req.user;
  res.json({ user: { ...toProfile(user), role: user.role } });
});

// ---------------- A host's own cars ----------------

/** GET /host/cars  -> { data: [Car] } */
exports.listCars = asyncHandler(async (req, res) => {
  const cars = await prisma.car.findMany({
    where: { ownerId: req.user.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: cars });
});

/** POST /host/cars  { ...car fields }  -> { data: Car } */
exports.createCar = asyncHandler(async (req, res) => {
  if (!req.body.name) throw ApiError.badRequest('Car name is required');
  if (req.user.role === 'user') {
    await prisma.user.update({ where: { id: req.user.id }, data: { role: 'host' } });
    req.user.role = 'host';
  }
  const car = await prisma.car.create({
    data: {
      ...req.body,
      ownerId: req.user.id,
      host: {
        name: req.user.name || req.body.host?.name || 'Host',
        avatarUrl: req.user.avatarUrl || '',
        rating: 0,
        trips: 0,
      },
    },
  });
  res.status(201).json({ data: car });
});

/** PATCH /host/cars/:id  -> { data: Car }  (own car only) */
exports.updateCar = asyncHandler(async (req, res) => {
  const existing = await prisma.car.findFirst({
    where: { id: req.params.id, ownerId: req.user.id },
  });
  if (!existing) throw ApiError.notFound('Car not found');
  const editable = [
    'name', 'type', 'images', 'rcBook', 'pricePerHour', 'pricePerDay', 'transmission',
    'fuel', 'seats', 'features', 'pickupAddress', 'lat', 'lng',
    'fuelPolicy', 'cancellationPolicy', 'active',
  ];
  const data = {};
  editable.forEach((f) => { if (req.body[f] !== undefined) data[f] = req.body[f]; });
  const car = await prisma.car.update({ where: { id: existing.id }, data });
  res.json({ data: car });
});

/** DELETE /host/cars/:id  (own car only) */
exports.deleteCar = asyncHandler(async (req, res) => {
  const existing = await prisma.car.findFirst({
    where: { id: req.params.id, ownerId: req.user.id },
  });
  if (!existing) throw ApiError.notFound('Car not found');
  await prisma.car.delete({ where: { id: existing.id } });
  res.json({ data: { id: req.params.id, deleted: true } });
});

// ---------------- Earnings / dashboard ----------------

/** GET /host/stats  -> { data: HostStats }  (shape matches host_stats.dart) */
exports.stats = asyncHandler(async (req, res) => {
  const cars = await prisma.car.findMany({ where: { ownerId: req.user.id } });
  const carIds = cars.map((c) => c.id);

  const bookings = await bookingsForCars(carIds);

  const earning = (b) => hostShare(b.fare?.base);
  const isEarning = (b) => ['ongoing', 'completed'].includes(b.status);

  const totalEarnings = bookings.filter(isEarning).reduce((s, b) => s + earning(b), 0);

  const now = new Date();
  const monthEarnings = bookings
    .filter((b) => isEarning(b) && new Date(b.start).getMonth() === now.getMonth() &&
      new Date(b.start).getFullYear() === now.getFullYear())
    .reduce((s, b) => s + earning(b), 0);

  // Last 6 months of earnings.
  const monthly = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const amount = bookings
      .filter((b) => isEarning(b) &&
        new Date(b.start).getMonth() === d.getMonth() &&
        new Date(b.start).getFullYear() === d.getFullYear())
      .reduce((s, b) => s + earning(b), 0);
    monthly.push({ month: MONTHS[d.getMonth()], amount });
  }

  // Per-car stats.
  const carStats = cars.map((c) => {
    const cb = bookings.filter((b) => b.car?.id === c.id);
    return {
      // id + features are required for the host edit flow: without the id the
      // app can't target a PATCH /host/cars/:id (it bails on an empty id), and
      // without features the edit form starts blank and would wipe them on save.
      id: c.id,
      name: c.name,
      image: (c.images && c.images[0]) || '',
      // Full photo list so the host edit form can re-seed every photo (not
      // just the thumbnail) and preserve them on save.
      images: c.images || [],
      // RC book photos so the edit form can show/preserve ownership proof.
      rcBook: c.rcBook || [],
      trips: cb.length,
      earnings: cb.filter(isEarning).reduce((s, b) => s + earning(b), 0),
      rating: c.rating,
      active: c.active,
      type: c.type,
      transmission: c.transmission,
      fuel: c.fuel,
      seats: c.seats,
      pricePerDay: c.pricePerDay,
      pickupAddress: c.pickupAddress,
      features: c.features,
    };
  });

  // Recent bookings with renter names.
  const recent = bookings.slice(0, 5);
  const renterIds = [...new Set(recent.map((b) => b.user))];
  const renters = await prisma.user.findMany({ where: { id: { in: renterIds } } });
  const nameOf = (id) => (renters.find((u) => u.id === id) || {}).name || 'Renter';
  const recentBookings = recent.map((b) => ({
    renter: nameOf(b.user),
    carName: b.car?.name || '—',
    dateRange: dateRange(b.start, b.end),
    amount: b.fare?.base || 0,
    status: cap(b.status),
  }));

  // Payouts already taken / in flight.
  const payouts = await prisma.payout.findMany({
    where: { host: req.user.id, status: { in: ['paid', 'requested'] } },
  });
  const reserved = payouts.reduce((s, p) => s + p.amount, 0);
  const pendingPayout = Math.max(0, totalEarnings - reserved);

  const ratingAvg = cars.length
    ? Math.round((cars.reduce((s, c) => s + (c.rating || 0), 0) / cars.length) * 10) / 10
    : 0;

  // Occupancy is an estimate: booked trips this month vs a nominal capacity.
  const monthTrips = bookings.filter(
    (b) => new Date(b.start).getMonth() === now.getMonth()
  ).length;
  const occupancyRate = cars.length
    ? Math.min(1, Math.round((monthTrips / (cars.length * 10)) * 100) / 100)
    : 0;

  res.json({
    data: {
      totalEarnings,
      monthEarnings,
      totalBookings: bookings.length,
      occupancyRate,
      rating: ratingAvg,
      pendingPayout,
      monthly,
      cars: carStats,
      recentBookings,
    },
  });
});

/**
 * GET /host/bookings?carName=&page=&limit=
 *   -> { data: [HostBookingSummary], page, limit, total, hasMore }
 * Bookings across the host's cars, optionally filtered to one car by name.
 * Paginated (always returns the envelope so the app can drive infinite scroll).
 * Shape of each item mirrors HostBookingSummary in host_stats.dart.
 */
exports.bookings = asyncHandler(async (req, res) => {
  const cars = await prisma.car.findMany({
    where: { ownerId: req.user.id },
    select: { id: true },
  });
  const carIds = cars.map((c) => c.id);

  const pg = pageParams(req) || { page: 1, limit: 20, skip: 0 };

  if (!carIds.length) {
    return res.json({ data: [], ...pageMeta(pg, 0) });
  }

  // Scope to the host's own cars, optionally narrowing to one car by name.
  // Booking.car is JSON, so filter + paginate in JS.
  const all = await bookingsForCars(carIds, {
    carName: req.query.carName !== undefined ? String(req.query.carName) : undefined,
  });
  const total = all.length;
  const bookings = all.slice(pg.skip, pg.skip + pg.limit);

  // Resolve renter names for this page only.
  const renterIds = [...new Set(bookings.map((b) => b.user))];
  const renters = await prisma.user.findMany({ where: { id: { in: renterIds } } });
  const nameOf = (id) => (renters.find((u) => String(u.id) === String(id)) || {}).name || 'Renter';

  const data = bookings.map((b) => ({
    id: b.id,
    renter: nameOf(b.user),
    carName: b.car?.name || '—',
    dateRange: dateRange(b.start, b.end),
    amount: b.fare?.base || 0,
    status: cap(b.status),
    unlockOtp: b.unlockOtp,
    isVerifiedByHost: b.isVerifiedByHost,
    // Drive the host's "cancel no-show" action: it unlocks 1 hour after start
    // for a trip the renter never began.
    start: b.start,
    end: b.end,
    tripStarted: b.tripStarted,
  }));

  res.json({ data, ...pageMeta(pg, total) });
});

// ---------------- Payouts ----------------

/** GET /host/payouts  -> { data: [Payout] } */
exports.listPayouts = asyncHandler(async (req, res) => {
  const data = await prisma.payout.findMany({
    where: { host: req.user.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data });
});

/**
 * POST /host/payouts  { amount? }  -> { data: Payout }
 * Requests a payout. Without an amount, requests the full pending balance.
 */
exports.requestPayout = asyncHandler(async (req, res) => {
  if (!req.user.upiId) throw ApiError.badRequest('Add a UPI ID to your profile before requesting a payout');

  // Reuse the stats computation to know what is withdrawable.
  const cars = await prisma.car.findMany({ where: { ownerId: req.user.id } });
  const carIds = cars.map((c) => c.id);
  const bookings = await bookingsForCars(carIds, { orderByCreatedDesc: false });
  const totalEarnings = bookings
    .filter((b) => ['ongoing', 'completed'].includes(b.status))
    .reduce((s, b) => s + hostShare(b.fare?.base), 0);
  const takenPayouts = await prisma.payout.findMany({
    where: { host: req.user.id, status: { in: ['paid', 'requested'] } },
  });
  const taken = takenPayouts.reduce((s, p) => s + p.amount, 0);
  const available = Math.max(0, totalEarnings - taken);

  const amount = req.body.amount ? Number(req.body.amount) : available;
  if (amount <= 0) throw ApiError.badRequest('No balance available to withdraw');
  if (amount > available) throw ApiError.badRequest(`Only ₹${available} is available to withdraw`);

  const payout = await prisma.payout.create({
    data: {
      host: req.user.id,
      hostName: req.user.name,
      amount,
      upiId: req.user.upiId,
      status: 'requested',
    },
  });
  res.status(201).json({ data: payout });
});
