import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import env from '../config/env.js';

/**
 * User — the single account document for every role (see 01-project-overview.md §6).
 * `role` is a field here, not a separate collection; club_lead is just a student
 * elevated to lead one or more clubs (tracked later via Club.leadIds).
 *
 * Every record carries `collegeId` so multi-college can be added later without a
 * rewrite — it's hardcoded to env.defaultCollegeId for now (§4).
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required.'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required.'],
      lowercase: true,
      trim: true,
    },
    // select: false — never ship the hash by default; opt in with .select('+password').
    password: {
      type: String,
      required: [true, 'Password is required.'],
      minlength: [6, 'Password must be at least 6 characters.'],
      select: false,
    },
    role: {
      type: String,
      enum: ['student', 'club_lead', 'faculty', 'admin'],
      default: 'student',
    },
    collegeId: {
      type: String,
      default: env.defaultCollegeId,
      index: true,
    },
    // Reserved for the deferred Cloudinary avatar upload (Phase 1 stretch).
    avatarUrl: {
      type: String,
      default: '',
    },
    // Optional student basics — used by later Clubs/Attendance phases.
    rollNumber: {
      type: String,
      trim: true,
    },
    department: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Email is unique per college (forward-compatible with multi-college).
userSchema.index({ collegeId: 1, email: 1 }, { unique: true });

/** Hash the password whenever it's set or changed — never store plaintext. */
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  return next();
});

/** Compare a plaintext attempt against the stored hash. */
userSchema.methods.matchPassword = function matchPassword(entered) {
  return bcrypt.compare(entered, this.password);
};

const User = mongoose.model('User', userSchema);

export default User;
