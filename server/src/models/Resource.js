import mongoose from 'mongoose';
import env from '../config/env.js';

/**
 * Resource — a course material a faculty member shares with the class (Phase 8).
 * Bolts onto the Course module the same way assignments do: only the course's
 * owning faculty (or an admin) can add/remove one, and any enrolled student (plus
 * the owner/admin) can list and open it.
 *
 * A resource is either an uploaded file (`fileUrl`, hosted on Cloudinary via
 * utils/uploadImage.uploadFile) or an external `linkUrl` (a Drive folder, a video,
 * a slide deck elsewhere) — at least one is always set. `type` is a short label
 * for the icon/badge, e.g. 'pdf', 'doc', 'slides', 'link'.
 */
const resourceSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Resource title is required.'],
      trim: true,
    },
    fileUrl: {
      type: String,
      default: '',
    },
    linkUrl: {
      type: String,
      default: '',
      trim: true,
    },
    type: {
      type: String,
      default: 'file',
      trim: true,
    },
    collegeId: {
      type: String,
      default: env.defaultCollegeId,
      index: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// List a course's materials newest-first.
resourceSchema.index({ courseId: 1, createdAt: -1 });

const Resource = mongoose.model('Resource', resourceSchema);

export default Resource;
