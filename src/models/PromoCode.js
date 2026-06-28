'use strict';

const mongoose = require('mongoose');
const { jsonIdPlugin } = require('./plugins');

const promoSchema = new mongoose.Schema(
  {
    // The code itself is the id (e.g. "FIRST20"). Always stored uppercase.
    _id: { type: String },
    code: { type: String, required: true },
    discountPct: { type: Number, default: 0 }, // 0..1 (0.20 = 20% off)
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    maxDiscount: { type: Number, default: 0 }, // 0 = no cap
    minFare: { type: Number, default: 0 }, // minimum base fare to qualify
    active: { type: Boolean, default: true },
    validFrom: { type: Date, default: null },
    validTo: { type: Date, default: null },
  },
  { timestamps: true }
);

promoSchema.plugin(jsonIdPlugin);

module.exports = mongoose.model('PromoCode', promoSchema);
