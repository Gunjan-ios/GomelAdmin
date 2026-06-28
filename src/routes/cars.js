'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/carController');
const { requireAuth } = require('../middleware/auth');

router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);
router.get('/:id/reviews', ctrl.reviews);
router.post('/:id/reviews', requireAuth, ctrl.createReview);

module.exports = router;
