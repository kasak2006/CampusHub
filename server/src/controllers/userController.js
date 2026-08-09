import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';
import { toPublicUser } from './authController.js';

/**
 * PATCH /api/users/me
 * Self-service profile edit. Only name, rollNumber, and department are editable
 * here — role, email, password, and avatar are intentionally out of scope
 * (role changes are an admin action; avatar upload is deferred). Requires `protect`.
 */
export const updateProfile = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    res.status(404);
    return next(new Error('User no longer exists.'));
  }

  const { name, rollNumber, department } = req.body;
  if (name !== undefined) user.name = name;
  if (rollNumber !== undefined) user.rollNumber = rollNumber;
  if (department !== undefined) user.department = department;

  await user.save();
  return res.json({ user: toPublicUser(user) });
});

export default updateProfile;
