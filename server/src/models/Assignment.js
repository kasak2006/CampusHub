import mongoose from 'mongoose';
import env from '../config/env.js';

/**
 * Assignment — a piece of graded coursework a faculty member sets on a course
 * (Phase 7). Bolts onto the existing Course module: only the course's owning
 * faculty (or an admin) can create/edit it, and only enrolled students submit.
 *
 * `points` is the maximum score. `attachmentUrl` is an optional single reference
 * file (a brief/handout) uploaded to Cloudinary via utils/uploadImage.uploadFile.
 */
const assignmentSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Assignment title is required.'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    dueAt: {
      type: Date,
      required: [true, 'A due date is required.'],
    },
    points: {
      type: Number,
      default: 100,
      min: [0, 'Points cannot be negative.'],
    },
    attachmentUrl: {
      type: String,
      default: '',
    },
    // Optional external link the faculty attaches — e.g. a Google Form to submit
    // through, a Drive folder, or a spec hosted elsewhere.
    linkUrl: {
      type: String,
      default: '',
      trim: true,
    },
    collegeId: {
      type: String,
      default: env.defaultCollegeId,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// List a course's assignments by due date.
assignmentSchema.index({ courseId: 1, dueAt: 1 });

const Assignment = mongoose.model('Assignment', assignmentSchema);

export default Assignment;
