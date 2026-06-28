'use strict';

const prisma = require('../db/prisma');

/** Connect to PostgreSQL via Prisma. Exits the process if it cannot connect. */
async function connectDb() {
  try {
    await prisma.$connect();
    console.log('✅ PostgreSQL connected (Prisma)');
  } catch (err) {
    console.error('❌ PostgreSQL connection failed:', err.message);
    process.exit(1);
  }
}

module.exports = connectDb;
