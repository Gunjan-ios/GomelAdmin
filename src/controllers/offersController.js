'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const prisma = require('../db/prisma');

/** GET /offers  -> { data: [PromoCode] }  (active codes, public) */
exports.list = asyncHandler(async (req, res) => {
  const now = new Date();
  const data = await prisma.promoCode.findMany({
    where: { active: true },
    orderBy: { discountPct: 'desc' },
  });
  // Filter out anything outside its validity window.
  const live = data.filter(
    (p) => (!p.validFrom || p.validFrom <= now) && (!p.validTo || p.validTo >= now)
  );
  res.json({ data: live });
});

/**
 * POST /offers/validate  { code, fareBase }  -> { data: { ...applied } }
 * Returns the computed discount for a code against a given base fare.
 */
exports.validate = asyncHandler(async (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  const fareBase = Number(req.body.fareBase || 0);
  if (!code) throw ApiError.badRequest('code is required');

  const promo = await prisma.promoCode.findUnique({ where: { id: code } });
  const now = new Date();
  if (
    !promo ||
    !promo.active ||
    (promo.validFrom && promo.validFrom > now) ||
    (promo.validTo && promo.validTo < now)
  ) {
    throw ApiError.badRequest('Invalid or expired code');
  }
  if (fareBase < promo.minFare) {
    throw ApiError.badRequest(`Minimum fare of ₹${promo.minFare} required for this code`);
  }

  let discount = Math.round(fareBase * promo.discountPct);
  if (promo.maxDiscount > 0) discount = Math.min(discount, promo.maxDiscount);

  res.json({
    data: {
      code: promo.id,
      discountPct: promo.discountPct,
      discount,
      title: promo.title,
      description: promo.description,
      valid: true,
    },
  });
});
