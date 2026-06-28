'use strict';

const mongoose = require('mongoose');
const { genId } = require('../utils/id');
const { jsonIdPlugin } = require('./plugins');

const messageSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => genId('msg') },
    conversation: { type: String, ref: 'Conversation', required: true, index: true },
    sender: { type: String, default: null }, // user id, or null for support/system
    senderRole: {
      type: String,
      enum: ['user', 'host', 'support', 'system'],
      default: 'user',
    },
    text: { type: String, required: true },
    time: { type: Date, default: Date.now, index: true },
  },
  {}
);

messageSchema.plugin(jsonIdPlugin);

module.exports = mongoose.model('Message', messageSchema);
