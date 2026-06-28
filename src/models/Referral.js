'use strict';

const mongoose = require('mongoose');
const { genId } = require('../utils/id');
const { jsonIdPlugin } = require('./plugins');

const referralSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => genId('refl') },
    referrer: { type: String, ref: 'User', required: true, index: true }, // code owner
    referee: { type: String, ref: 'User', required: true, index: true }, // new user
    code: { type: String, default: '' },
    reward: { type: Number, default: 0 },
    // pending until the referee completes their first trip.
    status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// A given referee can only be referred once.
referralSchema.index({ referee: 1 }, { unique: true });

referralSchema.plugin(jsonIdPlugin);

module.exports = mongoose.model('Referral', referralSchema);
