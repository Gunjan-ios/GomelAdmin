'use strict';

const mongoose = require('mongoose');
const { genId } = require('../utils/id');

const otpSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => genId('otp') },
    verificationId: { type: String, required: true, index: true },
    phone: { type: String, required: true, index: true },
    code: { type: String, required: true },
    consumed: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// TTL index: Mongo auto-deletes documents once expiresAt passes.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Otp', otpSchema);
