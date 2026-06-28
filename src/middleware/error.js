'use strict';

const env = require('../config/env');

/** 404 handler for unmatched routes. */
function notFound(req, res, next) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

/** Central error handler. Shapes every error as { message }. */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.statusCode || 500;

  // Friendly message for duplicate-key (e.g. phone already exists).
  // Prisma raises P2002 on a unique-constraint violation.
  let message = err.message || 'Something went wrong';
  if (err.code === 'P2002' || err.code === 11000) {
    message = 'A record with this value already exists';
  }

  if (status >= 500) {
    console.error('💥', err);
  }

  res.status(status).json({
    message,
    ...(env.isProd ? {} : { stack: status >= 500 ? err.stack : undefined }),
  });
}

module.exports = { notFound, errorHandler };
