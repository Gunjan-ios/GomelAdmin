'use strict';

/**
 * Wraps an async route handler so thrown errors / rejected promises are
 * forwarded to Express' error middleware instead of crashing the process.
 */
module.exports = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
