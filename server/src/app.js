import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

import env, { isProd } from './config/env.js';
import apiRoutes from './routes/index.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';

/**
 * Builds and returns the Express app (no listening here — that's server.js).
 * Kept separate so it can be imported by tests later.
 */
export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.clientOrigin,
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  if (!isProd) app.use(morgan('dev'));

  // Root ping so hitting the bare server URL isn't a 404.
  app.get('/', (req, res) => {
    res.json({ name: 'CampusHub API', docs: '/api/health' });
  });

  app.use('/api', apiRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
