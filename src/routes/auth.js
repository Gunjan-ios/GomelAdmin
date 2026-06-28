'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

router.post('/otp/request', ctrl.requestOtp);
router.post('/otp/verify', ctrl.verifyOtp);
router.get('/me', requireAuth, ctrl.me);
router.patch('/me', requireAuth, ctrl.updateMe);

// Push device-token registration (FCM).
router.post('/device-token', requireAuth, ctrl.registerDeviceToken);
router.post('/device-token/remove', requireAuth, ctrl.removeDeviceToken);

module.exports = router;
