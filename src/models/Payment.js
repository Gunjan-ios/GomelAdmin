'use strict';

const mongoose = require('mongoose');
const { genId } = require('../utils/id');
const { jsonIdPlugin } = require('./plugins');

const paymentSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => genId('pmt') },
    user: { type: String, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true }, // rupees
    currency: { type: String, default: 'INR' },
    purpose: {
      type: String,
      enum: ['booking', 'wallet', 'subscription', 'other'],
      default: 'other',
    },
    refId: { type: String, default: '' }, // bookingId / planId etc.

    razorpayOrderId: { type: String, default: '', index: true },
    razorpayPaymentId: { type: String, default: '' },
    razorpaySignature: { type: String, default: '' },

    status: { type: String, enum: ['created', 'paid', 'failed'], default: 'created' },
    mock: { type: Boolean, default: false },
  },
  { timestamps: true }
);

paymentSchema.plugin(jsonIdPlugin);

module.exports = mongoose.model('Payment', paymentSchema);
