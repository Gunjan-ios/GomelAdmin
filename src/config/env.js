'use strict';

require('dotenv').config();

/** Centralised, typed access to environment variables. */
const env = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: (process.env.NODE_ENV || 'development') === 'production',

  // PostgreSQL connection is read directly from DATABASE_URL by Prisma
  // (see prisma/schema.prisma + src/db/prisma.js).
  databaseUrl: process.env.DATABASE_URL || '',

  jwtSecret: process.env.JWT_SECRET || 'dev_secret_change_me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',

  masterOtp: process.env.MASTER_OTP || '',
  otpTtlMinutes: parseInt(process.env.OTP_TTL_MINUTES || '10', 10),

  adminEmail: process.env.ADMIN_EMAIL || 'admin@gomelcars.com',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',

  // Optional. When set (e.g. a real domain behind a proxy) it is used as-is for
  // upload URLs. When empty, upload URLs are derived from the incoming request
  // host so they're reachable from whatever host the client used (phone/emulator).
  publicBaseUrl: process.env.PUBLIC_BASE_URL || '',
  corsOrigin: process.env.CORS_ORIGIN || '*',

  // Razorpay. With no keys the API returns mock orders and accepts any
  // signature so the flow works in development (mirrors the app's key-driven
  // approach in app_config.dart).
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',

  // Firebase Cloud Messaging (push notifications). Supply the three values
  // from your Firebase service-account JSON to go live. With any of them
  // missing, push is DISABLED (the app and in-app notifications still work —
  // see utils/firebase.js). The private key in .env must keep its real
  // newlines escaped as "\n"; we un-escape them at init time.
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
  firebasePrivateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
};

env.useRealPayments = !!(env.razorpayKeyId && env.razorpayKeySecret);

// Push is on only when all three Firebase credentials are present.
env.pushEnabled = !!(
  env.firebaseProjectId &&
  env.firebaseClientEmail &&
  env.firebasePrivateKey
);

module.exports = env;
