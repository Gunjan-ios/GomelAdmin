'use strict';

const mongoose = require('mongoose');
const { genId } = require('../utils/id');

const entrySchema = new mongoose.Schema(
  {
    title: { type: String, default: '' },
    points: { type: Number, default: 0 }, // + earned, - redeemed
    date: { type: Date, default: Date.now },
  },
  { _id: false }
);

const loyaltySchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => genId('loy') },
    user: { type: String, ref: 'User', required: true, unique: true, index: true },
    points: { type: Number, default: 0 },
    history: { type: [entrySchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Loyalty', loyaltySchema);
