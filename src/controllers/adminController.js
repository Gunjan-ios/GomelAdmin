'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { signToken } = require('../utils/jwt');
const prisma = require('../db/prisma');
const {
  serializeUser,
  serializeBooking,
  subscriptionView,
  comparePassword,
  hashPassword,
  getSettings,
} = require('../db/helpers');
const business = require('../config/business');
const { notifyUser, notifyBroadcast } = require('../services/notify');
const { onBookingCompleted } = require('../services/rewards');

/** Strip client-supplied keys that Prisma won't accept on a write. */
function clean(body) {
  const out = { ...body };
  delete out._id;
  return out;
}

// ---------------- Admin auth ----------------

/** POST /admin/login  { email, password }  -> { token, user } */
exports.login = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!email || !password) throw ApiError.badRequest('email and password are required');

  const user = await prisma.user.findFirst({ where: { email, role: 'admin' } });
  if (!user) throw ApiError.unauthorized('Invalid credentials');

  const ok = await comparePassword(user, password);
  if (!ok) throw ApiError.unauthorized('Invalid credentials');

  const token = signToken({ userId: user.id, role: 'admin' });
  res.json({ token, user: adminProfile(user) });
});

/** Shape the admin fields the panel needs (used by login / me / profile update). */
function adminProfile(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    avatarUrl: u.avatarUrl,
    createdAt: u.createdAt,
  };
}

/** GET /admin/me -> the signed-in admin. Lets the panel restore the name on refresh. */
exports.me = asyncHandler(async (req, res) => {
  res.json({ data: adminProfile(req.user) });
});

/** PATCH /admin/profile { name?, email?, avatarUrl? } — edit the signed-in admin. */
exports.updateProfile = asyncHandler(async (req, res) => {
  const data = {};
  if (req.body.name !== undefined) data.name = String(req.body.name).trim();
  if (req.body.avatarUrl !== undefined) data.avatarUrl = String(req.body.avatarUrl);
  if (req.body.email !== undefined) {
    const email = String(req.body.email).trim().toLowerCase();
    if (email && !/^\S+@\S+\.\S+$/.test(email)) throw ApiError.badRequest('Invalid email address');
    data.email = email;
  }
  const u = await prisma.user.update({ where: { id: req.user.id }, data });
  res.json({ data: adminProfile(u) });
});

/** POST /admin/change-password { currentPassword, newPassword } */
exports.changePassword = asyncHandler(async (req, res) => {
  const currentPassword = String(req.body.currentPassword || '');
  const newPassword = String(req.body.newPassword || '');
  if (!currentPassword || !newPassword) {
    throw ApiError.badRequest('Current and new password are required');
  }
  if (newPassword.length < 8) {
    throw ApiError.badRequest('New password must be at least 8 characters');
  }

  const ok = await comparePassword(req.user, currentPassword);
  if (!ok) throw ApiError.unauthorized('Current password is incorrect');

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } });
  res.json({ data: { ok: true } });
});

/** GET /admin/config -> read-only business rules (locked with the client). */
exports.config = asyncHandler(async (req, res) => {
  res.json({
    data: {
      platformCommissionRate: business.platformCommissionRate,
      referralReward: business.referralReward,
      loyaltyEarnRate: business.loyaltyEarnRate,
      loyaltyTiers: business.loyaltyTiers,
    },
  });
});

// ---------------- Maintenance mode ----------------

/** GET /admin/maintenance -> { data: { maintenanceMode, maintenanceMessage } } */
exports.getMaintenance = asyncHandler(async (req, res) => {
  const s = await getSettings();
  res.json({
    data: {
      maintenanceMode: s.maintenanceMode,
      maintenanceMessage: s.maintenanceMessage,
    },
  });
});

/**
 * PATCH /admin/maintenance { maintenanceMode?, maintenanceMessage? }
 * Flips maintenance mode for the customer & host apps. The admin panel itself
 * is never blocked, so this can always be turned back off.
 */
exports.setMaintenance = asyncHandler(async (req, res) => {
  await getSettings(); // ensure the row exists
  const data = {};
  if (req.body.maintenanceMode !== undefined) {
    data.maintenanceMode = !!req.body.maintenanceMode;
  }
  if (req.body.maintenanceMessage !== undefined) {
    data.maintenanceMessage = String(req.body.maintenanceMessage).trim();
  }
  const s = await prisma.setting.update({ where: { id: 'app' }, data });
  res.json({
    data: {
      maintenanceMode: s.maintenanceMode,
      maintenanceMessage: s.maintenanceMessage,
    },
  });
});

// ---------------- Dashboard ----------------

/** GET /admin/stats -> headline counts for the dashboard. */
exports.stats = asyncHandler(async (req, res) => {
  const [users, hosts, cars, bookings, claims, revenueRows, pendingPayouts, pendingKyc] =
    await Promise.all([
      prisma.user.count({ where: { role: 'user' } }),
      prisma.user.count({ where: { role: 'host' } }),
      prisma.car.count(),
      prisma.booking.count(),
      prisma.damageClaim.count({ where: { status: { not: 'resolved' } } }),
      prisma.booking.findMany({
        where: { status: { in: ['ongoing', 'completed'] } },
        select: { fare: true },
      }),
      prisma.payout.count({ where: { status: 'requested' } }),
      prisma.user.count({ where: { licenseStatus: 'pending' } }),
    ]);

  // Revenue = sum of fare.base across ongoing/completed bookings (fare is JSON).
  const revenue = revenueRows.reduce((s, b) => s + ((b.fare && b.fare.base) || 0), 0);

  res.json({
    data: {
      users,
      hosts,
      cars,
      bookings,
      openClaims: claims,
      pendingKyc,
      pendingPayouts,
      revenue,
    },
  });
});

/**
 * GET /admin/notifications -> actionable items that need an admin's attention,
 * derived live (no stored rows). Covers: pending KYC, open damage claims,
 * requested payouts, and support threads awaiting a reply. Returns a flat list
 * sorted newest-first, plus per-group counts and a total badge count.
 */
exports.notifications = asyncHandler(async (req, res) => {
  const [kycUsers, claims, payouts, supportConvos] = await Promise.all([
    prisma.user.findMany({
      where: { licenseStatus: 'pending' },
      select: { id: true, name: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.damageClaim.findMany({
      where: { status: { not: 'resolved' } },
      select: { id: true, carName: true, severity: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.payout.findMany({
      where: { status: 'requested' },
      select: { id: true, hostName: true, amount: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.conversation.findMany({
      where: { type: 'support' },
      select: { id: true, participants: true, lastMessage: true, lastAt: true },
      orderBy: { lastAt: 'desc' },
    }),
  ]);

  // A support thread "needs a reply" when its newest message came from the
  // customer (senderRole 'user') — i.e. support hasn't answered the latest note.
  let supportItems = [];
  if (supportConvos.length) {
    const convoIds = supportConvos.map((c) => c.id);
    const latest = await prisma.message.findMany({
      where: { conversation: { in: convoIds } },
      orderBy: { time: 'desc' },
      select: { conversation: true, senderRole: true },
    });
    const lastRole = {};
    for (const m of latest) {
      if (lastRole[m.conversation] === undefined) lastRole[m.conversation] = m.senderRole;
    }

    const custIds = supportConvos.map((c) => c.participants[0]).filter(Boolean);
    const custs = custIds.length
      ? await prisma.user.findMany({ where: { id: { in: custIds } }, select: { id: true, name: true } })
      : [];
    const nameById = {};
    custs.forEach((u) => { nameById[u.id] = u.name; });

    supportItems = supportConvos
      .filter((c) => lastRole[c.id] === 'user')
      .map((c) => ({
        id: `support:${c.id}`,
        kind: 'support',
        title: 'New support message',
        body: `${nameById[c.participants[0]] || 'Customer'}: ${c.lastMessage || ''}`.slice(0, 140),
        time: c.lastAt,
        link: 'support',
      }));
  }

  const rupees = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

  const items = [
    ...kycUsers.map((u) => ({
      id: `kyc:${u.id}`,
      kind: 'kyc',
      title: 'License verification pending',
      body: `${u.name || 'A user'} submitted a license for review`,
      time: u.updatedAt,
      link: 'users',
    })),
    ...claims.map((c) => ({
      id: `claim:${c.id}`,
      kind: 'claim',
      title: 'Damage claim to review',
      body: `${c.carName || 'A car'} — ${c.severity} (${c.status})`,
      time: c.createdAt,
      link: 'claims',
    })),
    ...payouts.map((p) => ({
      id: `payout:${p.id}`,
      kind: 'payout',
      title: 'Payout requested',
      body: `${p.hostName || 'A host'} requested ${rupees(p.amount)}`,
      time: p.createdAt,
      link: 'payouts',
    })),
    ...supportItems,
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  res.json({
    data: {
      count: items.length,
      groups: {
        kyc: kycUsers.length,
        claims: claims.length,
        payouts: payouts.length,
        support: supportItems.length,
      },
      items,
    },
  });
});

// ---------------- Users ----------------

exports.listUsers = asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ data: users.map(serializeUser) });
});

exports.updateUser = asyncHandler(async (req, res) => {
  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound('User not found');
  const data = {};
  ['name', 'email', 'role', 'walletBalance', 'upiId'].forEach((f) => {
    if (req.body[f] !== undefined) data[f] = req.body[f];
  });
  const user = await prisma.user.update({ where: { id: existing.id }, data });
  res.json({ data: serializeUser(user) });
});

/** PATCH /admin/users/:id/kyc { status } — approve / reject licence. */
exports.setKyc = asyncHandler(async (req, res) => {
  const status = req.body.status;
  if (!['notSubmitted', 'pending', 'verified'].includes(status)) {
    throw ApiError.badRequest('Invalid KYC status');
  }
  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound('User not found');
  const user = await prisma.user.update({
    where: { id: existing.id },
    data: { licenseStatus: status },
  });

  await notifyUser(user.id, {
    type: 'system',
    title: status === 'verified' ? 'License verified ✅' : 'License update',
    body:
      status === 'verified'
        ? 'Your driving license has been verified. Happy driving!'
        : `Your license status is now: ${status}.`,
    data: { route: '/profile' },
  });

  res.json({ data: serializeUser(user) });
});

// ---------------- Cars ----------------

exports.listCars = asyncHandler(async (req, res) => {
  const cars = await prisma.car.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ data: cars });
});

exports.createCar = asyncHandler(async (req, res) => {
  const car = await prisma.car.create({ data: clean(req.body) });
  res.status(201).json({ data: car });
});

exports.updateCar = asyncHandler(async (req, res) => {
  const existing = await prisma.car.findUnique({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound('Car not found');
  const car = await prisma.car.update({ where: { id: existing.id }, data: clean(req.body) });
  res.json({ data: car });
});

exports.deleteCar = asyncHandler(async (req, res) => {
  const existing = await prisma.car.findUnique({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound('Car not found');
  await prisma.car.delete({ where: { id: existing.id } });
  res.json({ data: { id: req.params.id, deleted: true } });
});

// ---------------- Reviews ----------------

/** GET /admin/reviews?carId=  -> { data: [Review + carName] } */
exports.listReviews = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.carId) where.carId = req.query.carId;
  const reviews = await prisma.review.findMany({ where, orderBy: { date: 'desc' } });

  const carIds = [...new Set(reviews.map((r) => r.carId))];
  const cars = await prisma.car.findMany({
    where: { id: { in: carIds } },
    select: { id: true, name: true },
  });
  const nameById = Object.fromEntries(cars.map((c) => [c.id, c.name]));

  const data = reviews.map((r) => ({
    id: r.id,
    carId: r.carId,
    carName: nameById[r.carId] || r.carId,
    author: r.author || 'Guest',
    rating: r.rating,
    comment: r.comment || '',
    date: r.date,
  }));
  res.json({ data });
});

exports.createReview = asyncHandler(async (req, res) => {
  const review = await prisma.review.create({ data: clean(req.body) });
  // Keep the car's aggregate rating/count roughly in sync.
  const all = await prisma.review.findMany({ where: { carId: review.carId } });
  if (all.length) {
    const avg = all.reduce((s, r) => s + r.rating, 0) / all.length;
    await prisma.car.update({
      where: { id: review.carId },
      data: {
        rating: Math.round(avg * 10) / 10,
        reviewCount: all.length,
      },
    });
  }
  res.status(201).json({ data: review });
});

// ---------------- Bookings ----------------

exports.listBookings = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.status) where.status = req.query.status;
  const bookings = await prisma.booking.findMany({ where, orderBy: { createdAt: 'desc' } });

  // Manual "populate" of the booking's customer (no enforced relation in PG).
  const userIds = [...new Set(bookings.map((b) => b.user).filter(Boolean))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, phone: true, email: true },
  });
  const userById = Object.fromEntries(users.map((u) => [u.id, u]));

  // Admin sees the full record (including who booked + when), id re-exposed.
  const data = bookings.map((b) => ({ ...b, user: userById[b.user] || b.user }));
  res.json({ data });
});

exports.updateBooking = asyncHandler(async (req, res) => {
  const existing = await prisma.booking.findUnique({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound('Booking not found');
  const prevStatus = existing.status;
  const data = {};
  ['status', 'tripStarted', 'isVerifiedByHost'].forEach((f) => {
    if (req.body[f] !== undefined) data[f] = req.body[f];
  });
  const booking = await prisma.booking.update({ where: { id: existing.id }, data });

  // Award loyalty (with the renter's membership multiplier) + settle referrals
  // on the first transition to completed — same rule as the app/host path.
  if (prevStatus !== 'completed' && booking.status === 'completed') {
    await onBookingCompleted(booking);
  }
  res.json({ data: serializeBooking(booking) });
});

/**
 * GET /admin/bookings/:id/inspections
 * The pre-trip and post-trip inspections (with the photos the user captured)
 * for one booking, oldest first so preTrip naturally precedes postTrip.
 */
exports.listBookingInspections = asyncHandler(async (req, res) => {
  const data = await prisma.inspection.findMany({
    where: { bookingId: req.params.id },
    orderBy: { at: 'asc' },
  });
  res.json({ data });
});

// ---------------- Claims ----------------

exports.listClaims = asyncHandler(async (req, res) => {
  const claims = await prisma.damageClaim.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ data: claims });
});

exports.updateClaim = asyncHandler(async (req, res) => {
  const existing = await prisma.damageClaim.findUnique({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound('Claim not found');
  const data = {};
  ['status', 'insurer', 'processingFee'].forEach((f) => {
    if (req.body[f] !== undefined) data[f] = req.body[f];
  });
  const claim = await prisma.damageClaim.update({ where: { id: existing.id }, data });
  res.json({ data: claim });
});

// ---------------- Promo codes ----------------

exports.listOffers = asyncHandler(async (req, res) => {
  const data = await prisma.promoCode.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ data });
});

exports.createOffer = asyncHandler(async (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  if (!code) throw ApiError.badRequest('code is required');
  const existing = await prisma.promoCode.findUnique({ where: { id: code } });
  if (existing) throw ApiError.badRequest('That code already exists');
  const promo = await prisma.promoCode.create({
    data: {
      id: code,
      code,
      discountPct: Number(req.body.discountPct) || 0,
      title: req.body.title || '',
      description: req.body.description || '',
      maxDiscount: Number(req.body.maxDiscount) || 0,
      minFare: Number(req.body.minFare) || 0,
      active: req.body.active !== false,
    },
  });
  res.status(201).json({ data: promo });
});

exports.updateOffer = asyncHandler(async (req, res) => {
  const id = String(req.params.id).toUpperCase();
  const existing = await prisma.promoCode.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Code not found');
  const data = {};
  ['discountPct', 'title', 'description', 'maxDiscount', 'minFare', 'active'].forEach((f) => {
    if (req.body[f] !== undefined) data[f] = req.body[f];
  });
  const promo = await prisma.promoCode.update({ where: { id }, data });
  res.json({ data: promo });
});

exports.deleteOffer = asyncHandler(async (req, res) => {
  const id = String(req.params.id).toUpperCase();
  const existing = await prisma.promoCode.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Code not found');
  await prisma.promoCode.delete({ where: { id } });
  res.json({ data: { id: req.params.id, deleted: true } });
});

// ---------------- Loyalty redeem options ----------------

exports.listRewards = asyncHandler(async (req, res) => {
  const data = await prisma.redeemOption.findMany({ orderBy: { cost: 'asc' } });
  res.json({ data });
});

exports.createReward = asyncHandler(async (req, res) => {
  const id = String(req.body.id || '').trim();
  if (!id) throw ApiError.badRequest('id is required (e.g. r1 / r2 / r3)');
  const existing = await prisma.redeemOption.findUnique({ where: { id } });
  if (existing) throw ApiError.badRequest('That reward id already exists');
  const title = String(req.body.title || '').trim();
  if (!title) throw ApiError.badRequest('title is required');
  const cost = Number(req.body.cost);
  if (!Number.isFinite(cost) || cost <= 0) {
    throw ApiError.badRequest('cost must be a positive number of points');
  }
  const option = await prisma.redeemOption.create({
    data: {
      id,
      title,
      description: req.body.description || '',
      cost,
      value: Number(req.body.value) || 0,
      active: req.body.active !== false,
    },
  });
  res.status(201).json({ data: option });
});

exports.updateReward = asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const existing = await prisma.redeemOption.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Reward not found');
  const data = {};
  ['title', 'description', 'cost', 'value', 'active'].forEach((f) => {
    if (req.body[f] !== undefined) data[f] = req.body[f];
  });
  const option = await prisma.redeemOption.update({ where: { id }, data });
  res.json({ data: option });
});

exports.deleteReward = asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const existing = await prisma.redeemOption.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Reward not found');
  await prisma.redeemOption.delete({ where: { id } });
  res.json({ data: { id: req.params.id, deleted: true } });
});

// ---------------- Subscription plans ----------------

exports.listPlans = asyncHandler(async (req, res) => {
  const data = await prisma.subscriptionPlan.findMany({ orderBy: { monthlyPrice: 'asc' } });
  res.json({ data });
});

exports.createPlan = asyncHandler(async (req, res) => {
  const id = String(req.body.id || '').trim().toLowerCase();
  if (!id) throw ApiError.badRequest('id is required (e.g. basic / plus / pro)');
  const existing = await prisma.subscriptionPlan.findUnique({ where: { id } });
  if (existing) throw ApiError.badRequest('That plan id already exists');
  const plan = await prisma.subscriptionPlan.create({
    data: {
      id,
      name: req.body.name || id,
      monthlyPrice: Number(req.body.monthlyPrice) || 0,
      tagline: req.body.tagline || '',
      perks: Array.isArray(req.body.perks) ? req.body.perks : [],
      highlighted: req.body.highlighted === true,
      discountPct: Number(req.body.discountPct) || 0,
      waiveDeposit: req.body.waiveDeposit === true,
      loyaltyMultiplier: Number(req.body.loyaltyMultiplier) || 1,
    },
  });
  res.status(201).json({ data: plan });
});

exports.updatePlan = asyncHandler(async (req, res) => {
  const id = String(req.params.id).toLowerCase();
  const existing = await prisma.subscriptionPlan.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Plan not found');
  const data = {};
  ['name', 'monthlyPrice', 'tagline', 'perks', 'highlighted',
    'discountPct', 'waiveDeposit', 'loyaltyMultiplier'].forEach((f) => {
    if (req.body[f] !== undefined) data[f] = req.body[f];
  });
  const plan = await prisma.subscriptionPlan.update({ where: { id }, data });
  res.json({ data: plan });
});

exports.deletePlan = asyncHandler(async (req, res) => {
  const id = String(req.params.id).toLowerCase();
  const existing = await prisma.subscriptionPlan.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Plan not found');
  await prisma.subscriptionPlan.delete({ where: { id } });
  res.json({ data: { id: req.params.id, deleted: true } });
});

/** GET /admin/subscribers -> users with a non-'none' subscription. */
exports.listSubscribers = asyncHandler(async (req, res) => {
  // subscription is a JSON column; filter + sort in JS (admin-scale data).
  const all = await prisma.user.findMany();
  const subscribers = all
    .filter((u) => u.subscription && ['active', 'cancelled', 'expired'].includes(u.subscription.status))
    .sort((a, b) => {
      const ta = a.subscription.startedAt ? new Date(a.subscription.startedAt).getTime() : 0;
      const tb = b.subscription.startedAt ? new Date(b.subscription.startedAt).getTime() : 0;
      return tb - ta;
    });

  const data = subscribers.map((u) => ({
    id: u.id,
    name: u.name,
    phone: u.phone,
    email: u.email,
    subscription: subscriptionView(u), // lazy-expiry applied
  }));
  res.json({ data });
});

// ---------------- Host payouts ----------------

exports.listPayouts = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.status) where.status = req.query.status;
  const payouts = await prisma.payout.findMany({ where, orderBy: { createdAt: 'desc' } });

  // Manual "populate" of the host user.
  const hostIds = [...new Set(payouts.map((p) => p.host).filter(Boolean))];
  const hosts = await prisma.user.findMany({
    where: { id: { in: hostIds } },
    select: { id: true, name: true, phone: true, email: true, upiId: true },
  });
  const hostById = Object.fromEntries(hosts.map((h) => [h.id, h]));

  const data = payouts.map((p) => ({ ...p, host: hostById[p.host] || p.host }));
  res.json({ data });
});

/** PATCH /admin/payouts/:id  { status }  — mark a payout paid / rejected. */
exports.updatePayout = asyncHandler(async (req, res) => {
  const status = req.body.status;
  if (!['requested', 'paid', 'rejected'].includes(status)) {
    throw ApiError.badRequest('Invalid payout status');
  }
  const existing = await prisma.payout.findUnique({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound('Payout not found');
  const data = { status };
  if (status === 'paid') data.paidAt = new Date();
  const payout = await prisma.payout.update({ where: { id: existing.id }, data });

  await notifyUser(payout.host, {
    type: 'system',
    title: status === 'paid' ? 'Payout sent 💸' : 'Payout update',
    body:
      status === 'paid'
        ? `₹${payout.amount} has been paid to ${payout.upiId}.`
        : `Your payout request is now: ${status}.`,
    data: { route: '/host' },
  });

  res.json({ data: payout });
});

// ---------------- Broadcast notification ----------------

exports.broadcast = asyncHandler(async (req, res) => {
  const n = await notifyBroadcast({
    type: req.body.type || 'system',
    title: req.body.title || '',
    body: req.body.body || '',
  });
  res.status(201).json({ data: n });
});
