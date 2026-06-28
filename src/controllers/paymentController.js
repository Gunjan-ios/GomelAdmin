'use strict';

const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const rzp = require('../utils/razorpay');
const prisma = require('../db/prisma');
const { moveWallet } = require('../services/rewards');

/**
 * Apply a paid payment's side effects exactly once (idempotent).
 * Currently: wallet top-ups credit the user's wallet.
 */
async function settlePayment(payment, razorpayPaymentId) {
  if (payment.status === 'paid') return payment; // already settled
  const data = { status: 'paid' };
  if (razorpayPaymentId) data.razorpayPaymentId = razorpayPaymentId;
  payment = await prisma.payment.update({ where: { id: payment.id }, data });

  if (payment.purpose === 'wallet') {
    const user = await prisma.user.findUnique({ where: { id: payment.user } });
    if (user) {
      await moveWallet(user, {
        type: 'credit',
        amount: payment.amount,
        source: 'topup',
        note: `Wallet top-up (${payment.razorpayPaymentId || payment.id})`,
      });
    }
  }

  // Membership: refId holds the plan id (basic/plus/pro). Activate for 30 days
  // from now — one-time order, no auto-renew (Option A).
  if (payment.purpose === 'subscription' && payment.refId) {
    const user = await prisma.user.findUnique({ where: { id: payment.user } });
    if (user) {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      // subscription is a JSON column on User.
      await prisma.user.update({
        where: { id: user.id },
        data: {
          subscription: {
            planId: payment.refId,
            status: 'active',
            startedAt: now,
            expiresAt,
          },
        },
      });
    }
  }
  return payment;
}

/**
 * POST /payments/razorpay/order  { amount, purpose, refId? }
 *   -> { orderId, amount, currency, keyId, mock }
 */
exports.createOrder = asyncHandler(async (req, res) => {
  // Fail safe: never run the mock (trust-everything) gateway in production.
  if (env.isProd && !env.razorpayKeySecret) {
    throw ApiError.badRequest('Payments are not configured');
  }
  const amount = Number(req.body.amount || 0);
  if (!amount || amount <= 0) throw ApiError.badRequest('A valid amount is required');
  const purpose = req.body.purpose || 'other';

  const order = await rzp.createOrder({
    amount,
    receipt: `rcpt_${Date.now()}`,
    notes: { userId: req.user.id, purpose },
  });

  await prisma.payment.create({
    data: {
      user: req.user.id,
      amount,
      purpose,
      refId: req.body.refId || '',
      razorpayOrderId: order.id,
      status: 'created',
      mock: !!order.mock,
    },
  });

  res.status(201).json({
    data: {
      orderId: order.id,
      amount: order.amount, // paise
      currency: order.currency || 'INR',
      keyId: env.razorpayKeyId, // empty in mock mode
      mock: !!order.mock,
    },
  });
});

/**
 * POST /payments/razorpay/verify
 *   { razorpayOrderId, razorpayPaymentId, razorpaySignature }
 *   -> { success, payment }
 */
exports.verify = asyncHandler(async (req, res) => {
  // Fail safe: in production a real secret must be configured, otherwise the
  // signature check below would trust any payment.
  if (env.isProd && !env.razorpayKeySecret) {
    throw ApiError.badRequest('Payments are not configured');
  }
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
  if (!razorpayOrderId) throw ApiError.badRequest('razorpayOrderId is required');

  const payment = await prisma.payment.findFirst({
    where: {
      razorpayOrderId,
      user: req.user.id,
    },
  });
  if (!payment) throw ApiError.notFound('Payment not found');

  const ok = rzp.verifyPaymentSignature({
    orderId: razorpayOrderId,
    paymentId: razorpayPaymentId,
    signature: razorpaySignature,
  });

  if (!ok) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'failed' },
    });
    throw ApiError.badRequest('Payment signature verification failed');
  }

  // Persist the signature, then apply the (idempotent) settlement side effects.
  const signed = await prisma.payment.update({
    where: { id: payment.id },
    data: { razorpaySignature: razorpaySignature || '' },
  });
  const settled = await settlePayment(signed, razorpayPaymentId);

  res.json({ data: { success: true, payment: settled } });
});

/**
 * POST /payments/razorpay/webhook  (called by Razorpay, no auth)
 * Verifies the signature over the raw body, then settles the matching payment.
 */
exports.webhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const raw = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));

  if (!rzp.verifyWebhookSignature(raw, signature)) {
    return res.status(400).json({ message: 'Invalid webhook signature' });
  }

  const event = req.body && req.body.event;
  const entity =
    req.body &&
    req.body.payload &&
    (req.body.payload.payment ? req.body.payload.payment.entity : null);

  if ((event === 'payment.captured' || event === 'order.paid') && entity) {
    const payment = await prisma.payment.findFirst({
      where: { razorpayOrderId: entity.order_id },
    });
    if (payment) await settlePayment(payment, entity.id);
  }

  // Always 200 so Razorpay stops retrying once received.
  res.json({ received: true });
});
