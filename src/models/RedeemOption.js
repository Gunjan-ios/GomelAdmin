'use strict';

const mongoose = require('mongoose');
const { jsonIdPlugin } = require('./plugins');

const redeemOptionSchema = new mongoose.Schema(
  {
    _id: { type: String }, // human id: r1 / r2 / r3
    title: { type: String, required: true },
    description: { type: String, default: '' },
    cost: { type: Number, required: true }, // points required
    value: { type: Number, default: 0 }, // rupees off (0 = non-monetary perk)
    active: { type: Boolean, default: true },
  },
  {}
);

redeemOptionSchema.plugin(jsonIdPlugin);

module.exports = mongoose.model('RedeemOption', redeemOptionSchema);
