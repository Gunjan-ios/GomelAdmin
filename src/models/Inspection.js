'use strict';

const mongoose = require('mongoose');
const { genId } = require('../utils/id');
const { jsonIdPlugin } = require('./plugins');

const inspectionSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => genId('insp') },
    bookingId: { type: String, ref: 'Booking', required: true, index: true },
    type: { type: String, enum: ['preTrip', 'postTrip'], required: true },
    fuelLevel: { type: Number, default: 0 }, // 0..1
    odometer: { type: Number, default: 0 }, // km
    photosCaptured: { type: Number, default: 0 },
    photos: { type: [String], default: [] },
    notes: { type: String, default: '' },
    at: { type: Date, default: Date.now },

    user: { type: String, ref: 'User', default: null, index: true },
  },
  {}
);

inspectionSchema.plugin(jsonIdPlugin);

module.exports = mongoose.model('Inspection', inspectionSchema);
