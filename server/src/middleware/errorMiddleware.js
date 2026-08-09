import { isProd } from '../config/env.js';

/** 404 handler — reached when no route matched. */
export function notFound(req, res, next) {
  res.status(404);
  next(new Error(`Not found: ${req.method} ${req.originalUrl}`));
}

/** Central error handler. Keep this as the LAST app.use(). */
// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity (4 args).
export function errorHandler(err, req, res, next) {
  const status = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  res.status(status).json({
    message: err.message || 'Internal Server Error',
    ...(isProd ? {} : { stack: err.stack }),
  });
}
