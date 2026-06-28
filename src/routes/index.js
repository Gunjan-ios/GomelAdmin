'use strict';

const router = require('express').Router();
const { getSettings } = require('../db/helpers');

router.get('/', (req, res) => {
  res.json({ name: 'GoMel Cars API', status: 'ok', version: '1.0.0' });
});

/**
 * Maintenance gate. When the admin turns maintenance mode on, every customer &
 * host request is rejected with 503 so the apps drop into their maintenance
 * page even mid-session. The admin panel (/admin/*) and the public status probe
 * (/status, which the apps poll to know when it's lifted) are always allowed —
 * otherwise the admin couldn't turn it back off.
 */
router.use(async (req, res, next) => {
  if (req.path === '/status' || req.path.startsWith('/admin')) return next();
  try {
    const s = await getSettings();
    if (s.maintenanceMode) {
      return res.status(503).json({
        maintenance: true,
        message: s.maintenanceMessage,
      });
    }
  } catch (_) {
    // Fail open: if the settings lookup errors, don't lock everyone out.
  }
  next();
});

router.use('/auth', require('./auth'));
router.use('/cars', require('./cars'));
router.use('/bookings', require('./bookings'));
router.use('/offers', require('./offers'));
router.use('/referral', require('./referral'));
router.use('/loyalty', require('./loyalty'));
router.use('/wallet', require('./wallet'));
router.use('/host', require('./host'));
router.use('/chats', require('./chat'));
router.use('/payments', require('./payments'));
router.use('/', require('./misc'));
router.use('/admin', require('./admin'));

module.exports = router;
