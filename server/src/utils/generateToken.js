import jwt from 'jsonwebtoken';
import env, { isProd } from '../config/env.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Cookie options shared by set + clear (they must match or the browser won't
 * clear it). In production the client (e.g. Vercel) and API (e.g. Render) live
 * on different domains, so the cookie has to be SameSite=None to ride
 * cross-site XHR — which browsers only allow when Secure is also set. In dev
 * everything is same-origin via the Vite proxy, so Lax + insecure is fine.
 */
const cookieOptions = {
  httpOnly: true,
  sameSite: isProd ? 'none' : 'lax',
  secure: isProd,
};

/**
 * Sign a JWT for the user and set it as an httpOnly cookie named `token` —
 * the exact cookie the `protect` middleware reads. The payload carries the
 * fields RBAC and scoping rely on: id, role, collegeId.
 */
export function generateToken(res, user) {
  const token = jwt.sign(
    { id: user._id.toString(), role: user.role, collegeId: user.collegeId },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );

  res.cookie('token', token, { ...cookieOptions, maxAge: SEVEN_DAYS_MS });

  return token;
}

/** Clear the auth cookie (logout). Options must match those used when setting it. */
export function clearToken(res) {
  res.clearCookie('token', cookieOptions);
}

export default generateToken;
