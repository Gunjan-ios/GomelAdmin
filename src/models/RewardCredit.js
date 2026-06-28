'use strict';

const mongoose = require('mongoose');
const { genId } = require('../utils/id');
const { jsonIdPlugin } = require('./plugins');

const rewardCreditSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => genId('rc') },
    user: { type: String, ref: 'User', required: true, index: true },
    title: { type: String, default: '' }, // e.g. "₹100 off next trip"
    value: { type: Number, default: 0 }, // rupees off
    source: {
      type: String,
      enum: ['redeem', 'referral', 'promo', 'manual'],
      default: 'redeem',
    },
    used: { type: Boolean, default: false },
  },
  { timestamps: true }
);

rewardCreditSchema.plugin(jsonIdPlugin);

module.exports = mongoose.model('RewardCredit', rewardCreditSchema);
