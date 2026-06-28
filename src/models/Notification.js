'use strict';

const mongoose = require('mongoose');
const { genId } = require('../utils/id');
const { jsonIdPlugin } = require('./plugins');

const notificationSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => genId('ntf') },
    // null user => broadcast to everyone.
    user: { type: String, ref: 'User', default: null, index: true },
    type: {
      type: String,
      enum: ['booking', 'reminder', 'offer', 'system'],
      default: 'system',
    },
    title: { type: String, default: '' },
    body: { type: String, default: '' },
    date: { type: Date, default: Date.now },
    read: { type: Boolean, default: false },
  },
  {}
);

notificationSchema.set('toJSON', {
  versionKey: false,
  transform(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.user;
    return ret;
  },
});

module.exports = mongoose.model('Notification', notificationSchema);
