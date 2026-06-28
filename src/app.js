'use strict';

const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const env = require('./config/env');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();

function getUploadBaseUrl(req) {
  if (env.publicBaseUrl) return env.publicBaseUrl.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}`.replace(/\/$/, '');
}

function normalizeUploadUrls(value, baseUrl) {
  if (value == null) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const match = trimmed.match(/^(?:https?:\/\/[^/]+)?(\/uploads\/[^?#]+(?:[?#].*)?)$/);
    if (match) return `${baseUrl}${match[1]}`;
    return trimmed;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeUploadUrls(item, baseUrl));
  }
  if (typeof value === 'object') {
    return Object.keys(value).reduce((acc, key) => {
      acc[key] = normalizeUploadUrls(value[key], baseUrl);
      return acc;
    }, {});
  }
  return value;
}

app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    try {
      const baseUrl = getUploadBaseUrl(req);
      return originalJson(normalizeUploadUrls(body, baseUrl));
    } catch (err) {
      return originalJson(body);
    }
  };
  next();
});

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

// Admin web panel (static HTML/CSS/JS).
app.use('/admin-panel', express.static(path.join(__dirname, '..', 'public', 'admin')));

// Admin web panel — React port (Vite build output). Served side by side with the
// vanilla panel so the React version can be validated before it is promoted.
app.use('/admin-react', express.static(path.join(__dirname, '..', 'public', 'admin-react')));

// Health check.
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// All API routes are under /api.
app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
