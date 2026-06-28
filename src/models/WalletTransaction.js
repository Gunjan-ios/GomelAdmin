'use strict';

const mongoose = require('mongoose');
const { genId } = require('../utils/id');
const { jsonIdPlugin } = require('./plugins');

const walletTxnSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => genId('wtx') },
    user: { type: String, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['credit', 'debit'], required: true },
    amount: { type: Number, required: true },
    source: {
      type: String,
      enum: ['topup', 'referral', 'refund', 'booking', 'redeem', 'manual'],
      default: 'topup',
    },
    note: { type: String, default: '' },
    balanceAfter: { type: Number, default: 0 },
  },
  { timestamps: true }
);

walletTxnSchema.plugin(jsonIdPlugin);

module.exports = mongoose.model('WalletTransaction', walletTxnSchema);
