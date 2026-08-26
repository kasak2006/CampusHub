import mongoose from 'mongoose';
import env from '../config/env.js';

/**
 * Submission — one student's turn-in for one assignment (Phase 7).
 *
 * One document per (assignment, student), enforced by the unique compound index,
 * so re-submitting updates rather than duplicates — the same pattern as
 * Registration (event+user) and AttendanceRecord (session+student). `courseId`
 * is denormalized off the assignment so the gradebook can aggregate submissions
 * directly without joining through assignments.
 *
 * `late` is captured once at submission time (now > assignment.dueAt) and kept
 * even after grading, so status stays a clean lifecycle: 'submitted' → 'graded'.
 */
const submissionSchema = new mongoose.Schema(
  {
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      required: true,
      index: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    text: {
      type: String,
      default: '',
      trim: true,
    },
    fileUrl: {
      type: String,
      default: '',
    },
    late: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['submitted', 'graded'],
      default: 'submitted',
    },
    grade: {
      type: Number,
      default: null,
    },
    feedback: {
      type: String,
      default: '',
      trim: true,
    },
    submittedAt: {
      type: Date,
    },
    gradedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    gradedAt: {
      type: Date,
    },
    collegeId: {
      type: String,
      default: env.defaultCollegeId,
      index: true,
    },
  },
  { timestamps: true }
);

// At most one submission per student per assignment.
submissionSchema.index({ assignmentId: 1, studentId: 1 }, { unique: true });

const Submission = mongoose.model('Submission', submissionSchema);

export default Submission;
