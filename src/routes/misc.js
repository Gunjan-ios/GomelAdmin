'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/miscController');
const { requireAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Public
router.get('/status', ctrl.status);
router.get('/subscriptions', ctrl.listPlans);

// Authenticated
router.get('/subscriptions/me', requireAuth, ctrl.mySubscription);
router.post('/subscriptions/cancel', requireAuth, ctrl.cancelSubscription);

router.get('/notifications', requireAuth, ctrl.listNotifications);
router.patch('/notifications/:id/read', requireAuth, ctrl.markNotificationRead);
router.delete('/notifications/:id', requireAuth, ctrl.deleteNotification);
router.delete('/notifications', requireAuth, ctrl.clearNotifications);

router.get('/claims', requireAuth, ctrl.listClaims);
router.post('/claims', requireAuth, ctrl.createClaim);

router.post('/inspections', requireAuth, ctrl.createInspection);

router.post('/kyc', requireAuth, ctrl.submitKyc);

router.post('/uploads', requireAuth, upload.single('file'), ctrl.upload);

module.exports = router;
