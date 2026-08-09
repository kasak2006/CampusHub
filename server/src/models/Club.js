import mongoose from 'mongoose';
import env from '../config/env.js';

/**
 * Club — a student organization within the college (Phase 2, see 02-phase-plan.md).
 *
 * Membership model (per 01-project-overview.md §6):
 *   - `leadIds`   — users who manage this club. `club_lead` is not a separate
 *                   collection; it's the User.role assigned to whoever leads at
 *                   least one club, and the source of truth for *which* clubs is
 *                   this array. The creator is the first lead (self-service).
 *   - `memberIds` — approved members. A lead is always also a member.
 *
 * Every record carries `collegeId` so multi-college can be added later without a
 * rewrite — hardcoded to env.defaultCollegeId for now (§4).
 */
const clubSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Club name is required.'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    category: {
      type: String,
      default: 'General',
      trim: true,
    },
    logoUrl: {
      type: String,
      default: '',
    },
    collegeId: {
      type: String,
      default: env.defaultCollegeId,
      index: true,
    },
    leadIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    memberIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Club name is unique per college (forward-compatible with multi-college).
clubSchema.index({ collegeId: 1, name: 1 }, { unique: true });

const Club = mongoose.model('Club', clubSchema);

export default Club;
