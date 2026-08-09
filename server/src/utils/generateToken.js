import jwt from 'jsonwebtoken';
import env, { isProd } from '../config/env.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

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

  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: SEVEN_DAYS_MS,
  });

  return token;
}

/** Clear the auth cookie (logout). Options must match those used when setting it. */
export function clearToken(res) {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
  });
}

export default generateToken;
