'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/referralController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);
router.get('/', ctrl.mine);
router.post('/apply', ctrl.apply);

module.exports = router;
