'use strict';

const mongoose = require('mongoose');
const { jsonIdPlugin } = require('./plugins');

const planSchema = new mongoose.Schema(
  {
    // Plans use human ids (basic / plus / pro) to match the app.
    _id: { type: String },
    name: { type: String, required: true },
    monthlyPrice: { type: Number, default: 0 },
    tagline: { type: String, default: '' },
    perks: { type: [String], default: [] },
    highlighted: { type: Boolean, default: false },
  },
  {}
);

planSchema.plugin(jsonIdPlugin);

module.exports = mongoose.model('SubscriptionPlan', planSchema);
