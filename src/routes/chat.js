'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/chatController');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', ctrl.list);
router.get('/support', ctrl.support);
router.post('/host', ctrl.host);
router.get('/:id/messages', ctrl.messages);
router.post('/:id/messages', ctrl.send);
router.post('/:id/read', ctrl.markRead);

module.exports = router;
