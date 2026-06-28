'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/paymentController');
const { requireAuth } = require('../middleware/auth');

// Webhook is called by Razorpay (no user token; verified by signature).
router.post('/razorpay/webhook', ctrl.webhook);

// App-facing endpoints.
router.post('/razorpay/order', requireAuth, ctrl.createOrder);
router.post('/razorpay/verify', requireAuth, ctrl.verify);

module.exports = router;
