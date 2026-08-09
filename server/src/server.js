import http from 'http';

import env, { assertRequiredEnv } from './config/env.js';
import { connectDB } from './config/db.js';
import { configureCloudinary } from './config/cloudinary.js';
import { createApp } from './app.js';
import { initSocket } from './socket/index.js';

async function start() {
  assertRequiredEnv();
  configureCloudinary();

  // Connect to MongoDB first so we fail fast on a bad URI.
  try {
    await connectDB();
  } catch (err) {
    console.error('[startup] Could not connect to MongoDB:', err.message);
    console.error(
      '[startup] The server will still start so you can verify the API, ' +
        'but DB-backed routes will fail until MONGO_URI is valid.'
    );
  }

  const app = createApp();
  const httpServer = http.createServer(app);

  // Attach Socket.io to the same HTTP server.
  initSocket(httpServer);

  httpServer.listen(env.port, () => {
    console.log(`[startup] CampusHub API listening on http://localhost:${env.port}`);
    console.log(`[startup] Health check:        http://localhost:${env.port}/api/health`);
    console.log(`[startup] Environment:         ${env.nodeEnv}`);
  });
}

start().catch((err) => {
  console.error('[startup] Fatal error:', err);
  process.exit(1);
});
