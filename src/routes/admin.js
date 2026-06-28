'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/adminController');
const chat = require('../controllers/chatController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Public admin login.
router.post('/login', ctrl.login);

// Everything below requires an admin token.
router.use(requireAuth, requireAdmin);

router.get('/me', ctrl.me);
router.patch('/profile', ctrl.updateProfile);
router.get('/config', ctrl.config);
router.post('/change-password', ctrl.changePassword);

router.get('/maintenance', ctrl.getMaintenance);
router.patch('/maintenance', ctrl.setMaintenance);

router.get('/stats', ctrl.stats);

router.get('/users', ctrl.listUsers);
router.patch('/users/:id', ctrl.updateUser);
router.patch('/users/:id/kyc', ctrl.setKyc);

router.get('/cars', ctrl.listCars);
router.post('/cars', ctrl.createCar);
router.patch('/cars/:id', ctrl.updateCar);
router.delete('/cars/:id', ctrl.deleteCar);

router.get('/reviews', ctrl.listReviews);
router.post('/reviews', ctrl.createReview);

router.get('/bookings', ctrl.listBookings);
router.get('/bookings/:id/inspections', ctrl.listBookingInspections);
router.patch('/bookings/:id', ctrl.updateBooking);

router.get('/claims', ctrl.listClaims);
router.patch('/claims/:id', ctrl.updateClaim);

router.get('/offers', ctrl.listOffers);
router.post('/offers', ctrl.createOffer);
router.patch('/offers/:id', ctrl.updateOffer);
router.delete('/offers/:id', ctrl.deleteOffer);

router.get('/rewards', ctrl.listRewards);
router.post('/rewards', ctrl.createReward);
router.patch('/rewards/:id', ctrl.updateReward);
router.delete('/rewards/:id', ctrl.deleteReward);

router.get('/plans', ctrl.listPlans);
router.post('/plans', ctrl.createPlan);
router.patch('/plans/:id', ctrl.updatePlan);
router.delete('/plans/:id', ctrl.deletePlan);
router.get('/subscribers', ctrl.listSubscribers);

router.get('/payouts', ctrl.listPayouts);
router.patch('/payouts/:id', ctrl.updatePayout);

router.post('/broadcast', ctrl.broadcast);

// Support inbox — read & reply to customer support threads.
router.get('/support', chat.adminListSupport);
router.get('/support/:id/messages', chat.adminMessages);
router.post('/support/:id/messages', chat.adminSend);

module.exports = router;
