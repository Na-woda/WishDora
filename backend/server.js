// server.js — WishDora local development entrypoint.
// Builds the shared Express app (see app.js) with static frontend serving
// enabled, then starts it on a port. Netlify deploys the frontend via its CDN
// and the API via netlify/functions/api.js instead of running this file.
const mongoose = require('mongoose');
const createApp = require('./app');

const PORT = Number(process.env.PORT) || 5000;
const app = createApp({ serveStatic: true });

const tryListen = (port) => {
  const server = app.listen(port, () => {
    console.log(`\n🚀 WishDora API running on http://localhost:${port}`);
    console.log(`📋 API Docs: http://localhost:${port}/api/health`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && port < 5010) {
      console.warn(`⚠️ Port ${port} is busy, trying ${port + 1}...`);
      server.close(() => tryListen(port + 1));
    } else {
      console.error('❌ Failed to start server:', err.message);
      process.exit(1);
    }
  });
};

if (require.main === module) {
  tryListen(PORT);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received — shutting down gracefully');
    await mongoose.connection.close();
    process.exit(0);
  });
}

module.exports = app;
