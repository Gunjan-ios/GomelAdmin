'use strict';

/**
 * Central business rules (locked with the client). Mirrors the constants in
 * the Flutter app's app_config.dart so the backend and app stay in sync.
 */
const business = {
  // Platform commission charged to hosts per booking (app_config #8).
  platformCommissionRate: 0.2, // 20%

  // Refer & earn: both sides get ₹500 (referral_screen.dart).
  referralReward: 500,

  // Loyalty: points earned per rupee of base fare on a completed trip.
  // A ₹2400 trip earns ~240 points, matching the app's demo history.
  loyaltyEarnRate: 0.1,

  // Tiers, highest first (loyalty.dart thresholds: 500 / 1500 / 3000).
  loyaltyTiers: [
    { tier: 'platinum', min: 3000, next: 0 },
    { tier: 'gold', min: 1500, next: 3000 },
    { tier: 'silver', min: 500, next: 1500 },
    { tier: 'bronze', min: 0, next: 500 },
  ],
};

/** Resolve a point total to its tier + the threshold for the next tier. */
business.tierFor = function tierFor(points) {
  const t = business.loyaltyTiers.find((x) => points >= x.min);
  return { tier: t.tier, nextThreshold: t.next };
};

module.exports = business;
