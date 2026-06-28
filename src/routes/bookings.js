'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/bookingController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth); // all booking routes need a signed-in user

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.patch('/:id', ctrl.update);

module.exports = router;
