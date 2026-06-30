'use strict';

const http = require('http');
const app = require('./app');
const env = require('./config/env');
const connectDb = require('./config/db');
const realtime = require('./realtime/socket');
const scheduler = require('./services/scheduler');
const keepAlive = require('./scripts/keepAlive');

(async () => {
  await connectDb();
  // Wrap Express in an explicit HTTP server so Socket.IO can share the port.
  const server = http.createServer(app);
  realtime.init(server);
  // Poll for time-based booking reminders (1 hour before start / end).
  scheduler.start();
  // Keep the Render instance warm: self-ping /health every 12 minutes.
  keepAlive.start();
  server.listen(env.port, () => {
    console.log('');
    console.log('🚗 GoMel Cars API');
    console.log(`   API:         http://localhost:${env.port}/api`);
    console.log(`   Admin panel: http://localhost:${env.port}/admin-panel`);
    console.log(`   Realtime:    socket.io on the same port`);
    console.log(`   Env:         ${env.nodeEnv}`);
    console.log('');
  });
})();

// Fail loud on unhandled rejections during development.
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err);
});
