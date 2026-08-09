import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';
import { generateToken, clearToken } from '../utils/generateToken.js';

/** Strip sensitive/internal fields before sending a user to the client. */
function toPublicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    collegeId: user.collegeId,
    avatarUrl: user.avatarUrl,
    rollNumber: user.rollNumber,
    department: user.department,
  };
}

/**
 * POST /api/auth/register
 * Public student signup only — role is forced to 'student'. Faculty/admin are
 * created via the seed script (see server/src/seed.js), not this endpoint.
 */
export const registerUser = asyncHandler(async (req, res, next) => {
  const { name, email, password, rollNumber, department } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    return next(new Error('Name, email, and password are required.'));
  }

  const normalizedEmail = email.toLowerCase().trim();
  const exists = await User.findOne({ email: normalizedEmail });
  if (exists) {
    res.status(409);
    return next(new Error('An account with that email already exists.'));
  }

  const user = await User.create({
    name,
    email: normalizedEmail,
    password,
    role: 'student',
    rollNumber,
    department,
  });

  generateToken(res, user);
  return res.status(201).json({ user: toPublicUser(user) });
});

/**
 * POST /api/auth/login
 * Verifies credentials, issues the auth cookie, returns the public user.
 */
export const loginUser = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    return next(new Error('Email and password are required.'));
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
    '+password'
  );
  if (!user || !(await user.matchPassword(password))) {
    res.status(401);
    return next(new Error('Invalid email or password.'));
  }

  generateToken(res, user);
  return res.json({ user: toPublicUser(user) });
});

/** POST /api/auth/logout — clears the auth cookie. */
export const logoutUser = asyncHandler(async (req, res) => {
  clearToken(res);
  return res.json({ message: 'Logged out.' });
});

/**
 * GET /api/auth/me — returns the current user's fresh DB record.
 * Used by the client to restore a session from the cookie on page load.
 * Requires `protect` (req.user is the decoded JWT payload).
 */
export const getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    res.status(404);
    return next(new Error('User no longer exists.'));
  }
  return res.json({ user: toPublicUser(user) });
});

export { toPublicUser };
