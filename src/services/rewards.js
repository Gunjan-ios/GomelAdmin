'use strict';

/**
 * Shared rewards logic used across wallet, loyalty, referral and bookings.
 * Keeping it here avoids duplicating point/credit rules in each controller.
 */

const business = require('../config/business');
const { genReferralCode } = require('../utils/id');
const prisma = require('../db/prisma');
const { subscriptionView } = require('../db/helpers');
const { notifyUser } = require('./notify');

/** Ensure a user has a referral code; generate a unique one if missing. */
async function ensureReferralCode(user) {
  if (user.referralCode) return user.referralCode;
  let code;
  // Retry until we land on a code not already taken.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    code = genReferralCode(user.name);
    const clash = await prisma.user.findFirst({
      where: { referralCode: code },
      select: { id: true },
    });
    if (!clash) break;
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { referralCode: code },
  });
  user.referralCode = code;
  return code;
}

/** Get (or lazily create) the loyalty document for a user. */
async function getLoyalty(userId) {
  let loy = await prisma.loyalty.findFirst({ where: { user: userId } });
  if (!loy) {
    loy = await prisma.loyalty.create({ data: { user: userId, points: 0, history: [] } });
  }
  return loy;
}

/** Add (or subtract, if negative) loyalty points with a history entry. */
async function awardPoints(userId, title, points) {
  const loy = await getLoyalty(userId);
  const newPoints = Math.max(0, loy.points + points);
  // history is a JSON array — read-modify-write the whole field.
  const history = [{ title, points, date: new Date() }, ...(loy.history || [])];
  return prisma.loyalty.update({
    where: { id: loy.id },
    data: { points: newPoints, history },
  });
}

/**
 * Move money in/out of a user's wallet and record a transaction.
 * `type` is 'credit' or 'debit'. Returns the saved transaction.
 */
async function moveWallet(user, { type, amount, source, note }) {
  const delta = type === 'debit' ? -amount : amount;
  user.walletBalance = Math.max(0, (user.walletBalance || 0) + delta);
  await prisma.user.update({
    where: { id: user.id },
    data: { walletBalance: user.walletBalance },
  });
  return prisma.walletTransaction.create({
    data: {
      user: user.id,
      type,
      amount,
      source: source || 'manual',
      note: note || '',
      balanceAfter: user.walletBalance,
    },
  });
}

/**
 * Called when a booking transitions to "completed". Awards loyalty points to
 * the renter and, if this was a referred user's first completed trip, pays the
 * referrer their ₹500 reward to the wallet.
 */
async function onBookingCompleted(booking) {
  const userId = booking.user;
  const base = booking.fare?.base || 0;
  const carName = booking.car?.name || 'your car';

  // 1) Loyalty points for the trip — boosted by the renter's membership tier
  //    (Plus 2x, Pro 3x). Lazy expiry: an active plan still applies.
  let multiplier = 1;
  let memberLabel = '';
  const renter = await prisma.user.findUnique({ where: { id: userId } });
  const sub = renter && subscriptionView(renter);
  if (sub && sub.status === 'active') {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: sub.planId } });
    if (plan && plan.loyaltyMultiplier > 1) {
      multiplier = plan.loyaltyMultiplier;
      memberLabel = ` (${multiplier}x ${plan.name})`;
    }
  }
  const points = Math.round(base * business.loyaltyEarnRate * multiplier);
  if (points > 0) {
    await awardPoints(userId, `Trip completed — ${carName}${memberLabel}`, points);
  }

  // 2) Complete a pending referral (referrer earns the reward).
  const referral = await prisma.referral.findFirst({
    where: { referee: userId, status: 'pending' },
  });
  if (referral) {
    await prisma.referral.update({
      where: { id: referral.id },
      data: { status: 'completed', completedAt: new Date() },
    });

    const referrer = await prisma.user.findUnique({ where: { id: referral.referrer } });
    if (referrer) {
      await moveWallet(referrer, {
        type: 'credit',
        amount: referral.reward,
        source: 'referral',
        note: 'Referral reward — your friend completed their first trip',
      });
      await notifyUser(referrer.id, {
        type: 'system',
        title: 'You earned ₹' + referral.reward + ' 🎉',
        body: 'Your referral completed their first trip. Reward added to your wallet.',
        data: { route: '/wallet' },
      });
    }
  }
}

module.exports = {
  ensureReferralCode,
  getLoyalty,
  awardPoints,
  moveWallet,
  onBookingCompleted,
};
