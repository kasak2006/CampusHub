/**
 * Wrap an async route handler so a rejected promise is forwarded to Express's
 * error middleware (errorMiddleware.js) instead of crashing the process. Lets
 * controllers stay try/catch-free while keeping the next(error) error idiom.
 *
 *   router.post('/login', asyncHandler(loginUser));
 */
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

export default asyncHandler;
