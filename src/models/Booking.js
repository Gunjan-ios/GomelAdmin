'use strict';

const mongoose = require('mongoose');
const { genBookingId } = require('../utils/id');
const { jsonIdPlugin } = require('./plugins');

const fareSchema = new mongoose.Schema(
  {
    base: { type: Number, default: 0 },
    taxes: { type: Number, default: 0 },
    deposit: { type: Number, default: 0 },
    addOns: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    rewardDiscount: { type: Number, default: 0 },
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    _id: { type: String, default: genBookingId },
    // The whole car JSON is embedded (matches Booking.toJson in the app).
    car: { type: mongoose.Schema.Types.Mixed, required: true },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    package: {
      type: String,
      enum: ['hourly', 'daily', 'weekly'],
      default: 'daily',
    },
    fare: { type: fareSchema, default: () => ({}) },
    status: {
      type: String,
      enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
      default: 'upcoming',
    },
    unlockOtp: { type: String, default: '' },
    tripStarted: { type: Boolean, default: false },
    isVerifiedByHost: { type: Boolean, default: false },

    // Server-only.
    user: { type: String, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

bookingSchema.set('toJSON', {
  versionKey: false,
  transform(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    // Hide server-only fields from the mobile payload (harmless if left,
    // but keeps the response clean and matching the contract).
    delete ret.user;
    delete ret.createdAt;
    delete ret.updatedAt;
    return ret;
  },
});

module.exports = mongoose.model('Booking', bookingSchema);
