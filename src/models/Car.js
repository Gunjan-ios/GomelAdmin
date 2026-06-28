'use strict';

const mongoose = require('mongoose');
const { genId } = require('../utils/id');
const { jsonIdPlugin } = require('./plugins');

const hostSchema = new mongoose.Schema(
  {
    name: { type: String, default: '' },
    avatarUrl: { type: String, default: '' },
    rating: { type: Number, default: 0 },
    trips: { type: Number, default: 0 },
  },
  { _id: false }
);

const carSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => genId('car') },
    name: { type: String, required: true },
    type: { type: String, default: '' }, // SUV / Sedan / Hatchback
    images: { type: [String], default: [] },
    pricePerHour: { type: Number, default: 0 },
    pricePerDay: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    distanceKm: { type: Number, default: 0 },
    transmission: { type: String, enum: ['manual', 'automatic'], default: 'manual' },
    fuel: {
      type: String,
      enum: ['petrol', 'diesel', 'electric', 'hybrid'],
      default: 'petrol',
    },
    seats: { type: Number, default: 5 },
    features: { type: [String], default: [] },
    pickupAddress: { type: String, default: '' },
    lat: { type: Number, default: 0 },
    lng: { type: Number, default: 0 },
    fuelPolicy: { type: String, default: '' },
    cancellationPolicy: { type: String, default: '' },
    host: { type: hostSchema, default: () => ({}) },

    // Server-only fields (the app ignores extra keys).
    ownerId: { type: String, ref: 'User', default: null },
    active: { type: Boolean, default: true },
    city: { type: String, default: 'Ahmedabad' },
  },
  { timestamps: true }
);

carSchema.plugin(jsonIdPlugin);

module.exports = mongoose.model('Car', carSchema);
