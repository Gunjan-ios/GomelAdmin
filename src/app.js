'use strict';

const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const env = require('./config/env');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();

// CORS — allow the mobile app and the admin panel.
app.use(
  cors({
    origin: env.corsOrigin === '*' ? true : env.corsOrigin.split(','),
    credentials: true,
  })
);

// Keep the raw body around so the Razorpay webhook can verify its signature.
app.use(
  express.json({
    limit: '5mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true }));
if (!env.isProd) app.use(morgan('dev'));

// Uploaded files (car photos, KYC, damage photos).
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Admin web panel — React app (Vite build output in public/admin).
app.use('/admin-panel', express.static(path.join(__dirname, '..', 'public', 'admin')));

// Redirect root to the admin panel.
app.get('/', (req, res) => {
  res.redirect('/admin-panel/');
});

// Health check.
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// All API routes are under /api.
app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
