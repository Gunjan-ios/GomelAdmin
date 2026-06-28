'use strict';

const mongoose = require('mongoose');
const { genId } = require('../utils/id');
const { jsonIdPlugin } = require('./plugins');

const payoutSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => genId('pay') },
    host: { type: String, ref: 'User', required: true, index: true },
    hostName: { type: String, default: '' },
    amount: { type: Number, required: true },
    upiId: { type: String, default: '' },
    status: {
      type: String,
      enum: ['requested', 'paid', 'rejected'],
      default: 'requested',
    },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

payoutSchema.plugin(jsonIdPlugin);

module.exports = mongoose.model('Payout', payoutSchema);
