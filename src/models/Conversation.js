'use strict';

const mongoose = require('mongoose');
const { genId } = require('../utils/id');
const { jsonIdPlugin } = require('./plugins');

const conversationSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => genId('conv') },
    type: { type: String, enum: ['host', 'support'], required: true },
    participants: { type: [String], default: [], index: true }, // user ids
    title: { type: String, default: '' }, // host name or "GoMel Support"
    carId: { type: String, default: '' },
    bookingId: { type: String, default: '' },
    lastMessage: { type: String, default: '' },
    lastAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

conversationSchema.plugin(jsonIdPlugin);

module.exports = mongoose.model('Conversation', conversationSchema);
