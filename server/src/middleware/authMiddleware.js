import jwt from 'jsonwebtoken';
import env from '../config/env.js';

/**
 * Phase 0 skeleton for the auth spine (fully wired in Phase 1).
 *
 * `protect`   — verifies the JWT (from httpOnly cookie or Bearer header) and
 *               attaches the decoded payload to req.user.
 * `authorize` — factory that returns middleware restricting a route to one or
 *               more roles, e.g. authorize('faculty', 'admin').
 *
 * RBAC is enforced here at the route level, not just hidden in the UI
 * (see 01-project-overview.md §6).
 */
export function protect(req, res, next) {
  const token =
    req.cookies?.token ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : null);

  if (!token) {
    res.status(401);
    return next(new Error('Not authenticated — no token provided.'));
  }

  try {
    req.user = jwt.verify(token, env.jwtSecret);
    return next();
  } catch {
    res.status(401);
    return next(new Error('Not authenticated — invalid or expired token.'));
  }
}

export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401);
      return next(new Error('Not authenticated.'));
    }
    if (!roles.includes(req.user.role)) {
      res.status(403);
      return next(new Error(`Forbidden — requires role: ${roles.join(' or ')}.`));
    }
    return next();
  };
}
