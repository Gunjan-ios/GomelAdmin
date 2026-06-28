'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const business = require('../config/business');
const prisma = require('../db/prisma');
const { getLoyalty, awardPoints } = require('../services/rewards');

/** GET /loyalty  -> { data: { points, tier, nextThreshold, history } } */
exports.state = asyncHandler(async (req, res) => {
  const loy = await getLoyalty(req.user.id);
  const { tier, nextThreshold } = business.tierFor(loy.points);
  res.json({
    data: {
      points: loy.points,
      tier,
      nextThreshold,
      history: loy.history,
    },
  });
});

/** GET /loyalty/redeem-options  -> { data: [RedeemOption] } */
exports.redeemOptions = asyncHandler(async (req, res) => {
  const data = await prisma.redeemOption.findMany({
    where: { active: true },
    orderBy: { cost: 'asc' },
  });
  res.json({ data });
});

/** GET /loyalty/credits  -> { data: [RewardCredit] }  (unused credits) */
exports.credits = asyncHandler(async (req, res) => {
  const data = await prisma.rewardCredit.findMany({
    where: { user: req.user.id, used: false },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data });
});

/**
 * POST /loyalty/redeem  { optionId }  -> { data: { loyalty, credit } }
 * Deducts the option's point cost. If the option is monetary (value > 0) a
 * RewardCredit is created the user can apply to a future booking.
 */
exports.redeem = asyncHandler(async (req, res) => {
  const optionId = String(req.body.optionId || '').trim();
  const option = await prisma.redeemOption.findUnique({ where: { id: optionId } });
  if (!option || !option.active) throw ApiError.badRequest('Invalid redeem option');

  const loy = await getLoyalty(req.user.id);
  if (loy.points < option.cost) {
    throw ApiError.badRequest('Not enough points to redeem this reward');
  }

  await awardPoints(req.user.id, `Redeemed — ${option.title}`, -option.cost);

  let credit = null;
  if (option.value > 0) {
    credit = await prisma.rewardCredit.create({
      data: {
        user: req.user.id,
        title: option.title,
        value: option.value,
        source: 'redeem',
      },
    });
  }

  const fresh = await getLoyalty(req.user.id);
  const { tier, nextThreshold } = business.tierFor(fresh.points);

  res.status(201).json({
    data: {
      loyalty: { points: fresh.points, tier, nextThreshold, history: fresh.history },
      credit,
    },
  });
});
