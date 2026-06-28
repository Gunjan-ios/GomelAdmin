'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/loyaltyController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);
router.get('/', ctrl.state);
router.get('/redeem-options', ctrl.redeemOptions);
router.get('/credits', ctrl.credits);
router.post('/redeem', ctrl.redeem);

module.exports = router;
