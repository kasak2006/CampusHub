import mongoose from 'mongoose';
import env from '../config/env.js';

/**
 * Notification — one per recipient, the unit the topbar bell renders (Phase 6).
 *
 * These are fanned out when something happens a user should know about (today:
 * a new announcement in a scope they belong to). `type` labels the source and
 * `refId` points at the origin record (e.g. the Announcement) so the client can
 * deep-link. `link` is a ready-to-use client route so the bell doesn't have to
 * know how to build URLs per type.
 */
const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['announcement', 'assignment', 'grade'],
      required: true,
    },
    // Origin record (an Announcement/Assignment id); kept generic for later types.
    refId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    link: {
      type: String,
      default: '',
    },
    read: {
      type: Boolean,
      default: false,
    },
    collegeId: {
      type: String,
      default: env.defaultCollegeId,
      index: true,
    },
  },
  { timestamps: true }
);

// The bell reads a user's recent notifications and their unread count.
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
