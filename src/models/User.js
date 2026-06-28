'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { genId } = require('../utils/id');

const KYC_STATUS = ['notSubmitted', 'pending', 'verified'];
const ROLES = ['user', 'host', 'admin'];

const userSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => genId('user') },
    name: { type: String, default: '' },
    phone: { type: String, required: true, unique: true, index: true },
    email: { type: String, default: '' },
    avatarUrl: { type: String, default: '' },
    licenseStatus: { type: String, enum: KYC_STATUS, default: 'notSubmitted' },
    walletBalance: { type: Number, default: 0 },
    upiId: { type: String, default: '' },

    // Refer & earn.
    referralCode: { type: String, default: '', index: true },
    referredBy: { type: String, default: '' }, // code the user signed up with

    role: { type: String, enum: ROLES, default: 'user' },

    // KYC documents (set when the user submits their licence).
    kyc: {
      licenseNumber: { type: String, default: '' },
      frontImage: { type: String, default: '' },
      backImage: { type: String, default: '' },
    },

    // Only set for admin accounts (admin panel login).
    passwordHash: { type: String, default: '' },
  },
  { timestamps: true }
);

userSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await bcrypt.hash(plain, 10);
};

userSchema.methods.comparePassword = function comparePassword(plain) {
  if (!this.passwordHash) return Promise.resolve(false);
  return bcrypt.compare(plain, this.passwordHash);
};

/** The exact shape the Flutter `UserProfile.fromJson` expects. */
userSchema.methods.toProfile = function toProfile() {
  return {
    name: this.name,
    phone: this.phone,
    email: this.email,
    avatarUrl: this.avatarUrl,
    licenseStatus: this.licenseStatus,
    walletBalance: this.walletBalance,
    upiId: this.upiId,
  };
};

userSchema.set('toJSON', {
  versionKey: false,
  transform(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.passwordHash;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
module.exports.KYC_STATUS = KYC_STATUS;
module.exports.ROLES = ROLES;
