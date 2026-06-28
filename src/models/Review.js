'use strict';

const mongoose = require('mongoose');
const { genId } = require('../utils/id');
const { jsonIdPlugin } = require('./plugins');

const reviewSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => genId('rev') },
    carId: { type: String, ref: 'Car', required: true, index: true },
    author: { type: String, default: '' },
    avatarUrl: { type: String, default: '' },
    rating: { type: Number, default: 0 },
    comment: { type: String, default: '' },
    date: { type: Date, default: Date.now },
  },
  {}
);

reviewSchema.plugin(jsonIdPlugin);

module.exports = mongoose.model('Review', reviewSchema);
