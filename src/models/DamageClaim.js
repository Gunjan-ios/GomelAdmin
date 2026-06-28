'use strict';

const mongoose = require('mongoose');
const { genId } = require('../utils/id');
const { jsonIdPlugin } = require('./plugins');

const claimSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => genId('clm') },
    bookingId: { type: String, ref: 'Booking', default: '' },
    carName: { type: String, default: '' },
    severity: {
      type: String,
      enum: ['minor', 'moderate', 'major'],
      default: 'minor',
    },
    description: { type: String, default: '' },
    photosCaptured: { type: Number, default: 0 },
    photos: { type: [String], default: [] }, // uploaded image urls
    status: {
      type: String,
      enum: ['submitted', 'underReview', 'resolved'],
      default: 'submitted',
    },
    insurer: { type: String, default: '' },
    processingFee: { type: Number, default: 0 },

    user: { type: String, ref: 'User', default: null, index: true },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

claimSchema.plugin(jsonIdPlugin);

module.exports = mongoose.model('DamageClaim', claimSchema);
