import mongoose from 'mongoose';
import env from '../config/env.js';

/**
 * Course — a class a faculty member owns and takes attendance for (Phase 4).
 *
 * `facultyId` is the owner (only they, or an admin, manage the course and its
 * sessions). `studentIds` is the enrolled roster — the denominator context for
 * attendance analytics. `code` is a short human handle (e.g. "CS-301"), unique
 * per college so two courses can't collide.
 */
const courseSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Course name is required.'],
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Course code is required.'],
      trim: true,
      uppercase: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    facultyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    studentIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
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

// Course code is unique per college (forward-compatible with multi-college).
courseSchema.index({ collegeId: 1, code: 1 }, { unique: true });

const Course = mongoose.model('Course', courseSchema);

export default Course;
