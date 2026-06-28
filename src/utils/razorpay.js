'use strict';

const crypto = require('crypto');
const env = require('../config/env');

/** Constant-time string compare that won't throw on length mismatch. */
function safeEqual(a, b) {
  const ab = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Create a Razorpay order. With no API keys configured it returns a mock order
 * so the checkout flow is testable in development without charging anything.
 * `amount` is in rupees.
 */
async function createOrder({ amount, currency = 'INR', receipt = '', notes = {} }) {
  const amountPaise = Math.round(Number(amount) * 100);

  if (!env.useRealPayments) {
    return {
      id: 'order_mock_' + crypto.randomBytes(6).toString('hex'),
      amount: amountPaise,
      currency,
      status: 'created',
      mock: true,
    };
  }

  const auth = Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString('base64');
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Basic ${auth}` },
    body: JSON.stringify({ amount: amountPaise, currency, receipt, notes }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error((data && data.error && data.error.description) || 'Razorpay order creation failed');
  }
  return { ...data, mock: false };
}

/**
 * Verify the signature returned by Razorpay Checkout after a payment.
 * In mock mode (no secret) this returns true so dev flows pass.
 */
function verifyPaymentSignature({ orderId, paymentId, signature }) {
  if (!env.razorpayKeySecret) return true; // mock mode
  const expected = crypto
    .createHmac('sha256', env.razorpayKeySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return safeEqual(expected, signature);
}

/** Verify a Razorpay webhook payload against the X-Razorpay-Signature header. */
function verifyWebhookSignature(rawBody, signature) {
  if (!env.razorpayWebhookSecret) return false;
  const expected = crypto
    .createHmac('sha256', env.razorpayWebhookSecret)
    .update(rawBody)
    .digest('hex');
  return safeEqual(expected, signature);
}

module.exports = { createOrder, verifyPaymentSignature, verifyWebhookSignature };
