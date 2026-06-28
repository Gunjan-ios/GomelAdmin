'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const prisma = require('../db/prisma');
const { moveWallet } = require('../services/rewards');

/** GET /wallet  -> { data: { balance, transactions: [...] } } */
exports.summary = asyncHandler(async (req, res) => {
  const transactions = await prisma.walletTransaction.findMany({
    where: { user: req.user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({ data: { balance: req.user.walletBalance || 0, transactions } });
});

/**
 * POST /wallet/topup  { amount, paymentId? }  -> { data: { balance, transaction } }
 * In production, verify `paymentId` with Razorpay before crediting. For now it
 * credits the wallet and records the transaction.
 */
exports.topup = asyncHandler(async (req, res) => {
  const amount = Number(req.body.amount || 0);
  if (!amount || amount <= 0) throw ApiError.badRequest('Enter a valid amount');

  // Security: in production a top-up must go through a verified Razorpay
  // payment. The client should create an order (POST /payments/razorpay/order
  // with purpose "wallet") and verify it — `settlePayment` then credits the
  // wallet. Direct crediting here is only allowed in development for testing,
  // otherwise this would be a free-money endpoint.
  if (env.isProd) {
    throw ApiError.badRequest(
      'Direct top-up is disabled in production — complete the payment via Razorpay.'
    );
  }

  const txn = await moveWallet(req.user, {
    type: 'credit',
    amount,
    source: 'topup',
    note: req.body.paymentId ? `Top-up (${req.body.paymentId})` : 'Wallet top-up',
  });

  res.status(201).json({
    data: { balance: req.user.walletBalance, transaction: txn },
  });
});
