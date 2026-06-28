'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/offersController');
const { requireAuth } = require('../middleware/auth');

router.get('/', ctrl.list); // public list of active codes
router.post('/validate', requireAuth, ctrl.validate);

module.exports = router;
