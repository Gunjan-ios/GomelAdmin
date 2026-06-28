'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const business = require('../config/business');
const prisma = require('../db/prisma');
const { ensureReferralCode } = require('../services/rewards');

/**
 * GET /referral  -> { data: { code, reward, friendReward, referredCount,
 *                             totalEarned, referrals: [...] } }
 */
exports.mine = asyncHandler(async (req, res) => {
  const code = await ensureReferralCode(req.user);
  const referrals = await prisma.referral.findMany({
    where: { referrer: req.user.id },
    orderBy: { createdAt: 'desc' },
  });
  const completed = referrals.filter((r) => r.status === 'completed');
  const totalEarned = completed.reduce((s, r) => s + r.reward, 0);

  res.json({
    data: {
      code,
      reward: business.referralReward, // what the referrer earns
      friendReward: business.referralReward, // what the friend gets
      referredCount: referrals.length,
      completedCount: completed.length,
      totalEarned,
      referrals: referrals.map((r) => ({
        id: r.id,
        status: r.status,
        reward: r.reward,
        date: r.createdAt,
      })),
    },
  });
});

/**
 * POST /referral/apply  { code }  -> { data: { applied: true } }
 * The current user enters a friend's referral code at signup. The reward is
 * paid to the friend (referrer) when this user completes their first trip.
 */
exports.apply = asyncHandler(async (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  if (!code) throw ApiError.badRequest('code is required');

  if (req.user.referredBy) throw ApiError.badRequest('You have already used a referral code');

  const referrer = await prisma.user.findFirst({ where: { referralCode: code } });
  if (!referrer) throw ApiError.badRequest('Invalid referral code');
  if (referrer.id === req.user.id) throw ApiError.badRequest('You cannot use your own code');

  await prisma.user.update({
    where: { id: req.user.id },
    data: { referredBy: code },
  });
  req.user.referredBy = code;

  await prisma.referral.create({
    data: {
      referrer: referrer.id,
      referee: req.user.id,
      code,
      reward: business.referralReward,
      status: 'pending',
    },
  });

  res.status(201).json({
    data: {
      applied: true,
      friendReward: business.referralReward,
      message: `₹${business.referralReward} off applied. Your friend earns ₹${business.referralReward} when you finish your first trip.`,
    },
  });
});
