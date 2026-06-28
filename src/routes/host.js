'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/hostController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.post('/become', ctrl.become);

router.get('/cars', ctrl.listCars);
router.post('/cars', ctrl.createCar);
router.patch('/cars/:id', ctrl.updateCar);
router.delete('/cars/:id', ctrl.deleteCar);

router.get('/stats', ctrl.stats);
router.get('/bookings', ctrl.bookings);

router.get('/payouts', ctrl.listPayouts);
router.post('/payouts', ctrl.requestPayout);

module.exports = router;
