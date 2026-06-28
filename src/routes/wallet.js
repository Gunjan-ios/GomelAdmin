'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/walletController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);
router.get('/', ctrl.summary);
router.post('/topup', ctrl.topup);

module.exports = router;
