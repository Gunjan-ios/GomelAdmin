'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { pageParams, pageMeta } = require('../utils/paginate');
const prisma = require('../db/prisma');

/**
 * GET /cars?city=&type=&q=&page=&limit=
 *   -> { data: [Car] }                                  (no page param)
 *   -> { data: [Car], page, limit, total, hasMore }     (paginated)
 * Only active cars are returned to the app.
 */
exports.list = asyncHandler(async (req, res) => {
  const where = { active: true };
  if (req.query.city) where.city = req.query.city;
  if (req.query.type) where.type = req.query.type;
  if (req.query.q) where.name = { contains: String(req.query.q), mode: 'insensitive' };

  const orderBy = [{ distanceKm: 'asc' }, { createdAt: 'desc' }];
  const pg = pageParams(req);
  if (!pg) {
    const cars = await prisma.car.findMany({ where, orderBy });
    return res.json({ data: cars });
  }

  const [cars, total] = await Promise.all([
    prisma.car.findMany({ where, orderBy, skip: pg.skip, take: pg.limit }),
    prisma.car.count({ where }),
  ]);
  res.json({ data: cars, ...pageMeta(pg, total) });
});

/** GET /cars/:id  -> { data: Car } */
exports.getById = asyncHandler(async (req, res) => {
  const car = await prisma.car.findUnique({ where: { id: req.params.id } });
  if (!car) throw ApiError.notFound('Car not found');
  res.json({ data: car });
});

/** GET /cars/:id/reviews  -> { data: [Review] } */
exports.reviews = asyncHandler(async (req, res) => {
  const reviews = await prisma.review.findMany({
    where: { carId: req.params.id },
    orderBy: { date: 'desc' },
  });
  res.json({ data: reviews });
});

/** Recompute a car's aggregate rating + review count from its reviews. */
async function recomputeCarRating(carId) {
  const all = await prisma.review.findMany({ where: { carId } });
  if (!all.length) return;
  const avg = all.reduce((s, r) => s + r.rating, 0) / all.length;
  await prisma.car.update({
    where: { id: carId },
    data: {
      rating: Math.round(avg * 10) / 10,
      reviewCount: all.length,
    },
  });
}

/**
 * Recompute a host's rating from the reviews pooled across ALL of their cars,
 * and write it onto the embedded `host` object of each of their cars — which is
 * what the customer-facing car detail screen reads (`car.host.rating`).
 *
 * Reviews are car-level (there is no separate host review), so rating a host's
 * car is effectively rating the host: a host's rating is the average of every
 * review left on any of their cars. Demo/seed cars without an `ownerId` keep
 * their hardcoded host rating.
 */
async function recomputeHostRating(ownerId) {
  if (!ownerId) return;
  const cars = await prisma.car.findMany({ where: { ownerId } });
  if (!cars.length) return;
  const carIds = cars.map((c) => c.id);
  const reviews = await prisma.review.findMany({ where: { carId: { in: carIds } } });
  if (!reviews.length) return;
  const avg = Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10;
  // Denormalise onto every car's embedded host object so car detail shows it.
  await Promise.all(
    cars.map((c) =>
      prisma.car.update({
        where: { id: c.id },
        data: { host: { ...(c.host || {}), rating: avg } },
      }),
    ),
  );
}

/**
 * POST /cars/:id/reviews  { rating, comment? }  (auth required)
 * Lets a customer rate a car after a trip. Updates the car's aggregate rating.
 */
exports.createReview = asyncHandler(async (req, res) => {
  const car = await prisma.car.findUnique({ where: { id: req.params.id } });
  if (!car) throw ApiError.notFound('Car not found');

  const rating = Number(req.body.rating);
  if (!rating || rating < 1 || rating > 5) {
    throw ApiError.badRequest('A rating between 1 and 5 is required');
  }

  const review = await prisma.review.create({
    data: {
      carId: car.id,
      author: req.user.name || 'Guest',
      avatarUrl: req.user.avatarUrl || '',
      rating,
      comment: req.body.comment || '',
    },
  });

  await recomputeCarRating(car.id);
  await recomputeHostRating(car.ownerId);
  res.status(201).json({ data: review });
});
