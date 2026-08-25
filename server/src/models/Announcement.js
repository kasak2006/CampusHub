import mongoose from 'mongoose';
import env from '../config/env.js';

/**
 * Announcement — a broadcast from a faculty member, club lead, or admin (Phase 6).
 *
 * `scope` decides the audience and who may post:
 *   - 'college' → everyone in the college (faculty/admin only)
 *   - 'club'    → members of `targetId` club   (a lead of that club, or admin)
 *   - 'course'  → students of `targetId` course (that course's faculty, or admin)
 *
 * Posting an announcement fans out a per-recipient Notification (see
 * announcementController.createAnnouncement → utils/notify.js), which is what the
 * real-time bell in the topbar reacts to. `targetId` is null for college scope.
 */
const announcementSchema = new mongoose.Schema(
  {
    scope: {
      type: String,
      enum: ['college', 'club', 'course'],
      required: true,
    },
    // The club/course this is scoped to; null for a college-wide announcement.
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    title: {
      type: String,
      required: [true, 'Announcement title is required.'],
      trim: true,
    },
    body: {
      type: String,
      required: [true, 'Announcement body is required.'],
      trim: true,
    },
    pinned: {
      type: Boolean,
      default: false,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    collegeId: {
      type: String,
      default: env.defaultCollegeId,
      index: true,
    },
  },
  { timestamps: true }
);

// The read path lists by college + scope + target, newest (and pinned) first.
announcementSchema.index({ collegeId: 1, scope: 1, targetId: 1, createdAt: -1 });

const Announcement = mongoose.model('Announcement', announcementSchema);

export default Announcement;
