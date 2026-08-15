import mongoose from 'mongoose';
import env from '../config/env.js';

/**
 * AttendanceSession — one class meeting of a course on a given date (Phase 4).
 *
 * `dateKey` is the calendar day as a 'YYYY-MM-DD' string; it's what the unique
 * {courseId, dateKey} index guards against, so a course can't have two sessions
 * for the same day (the faculty edits the existing one instead). `date` keeps a
 * real Date for sorting and the analytics trend chart.
 */
const attendanceSessionSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: [true, 'Session date is required.'],
    },
    // Calendar-day key ('YYYY-MM-DD') — the duplicate-session guard (see index).
    dateKey: {
      type: String,
      required: true,
    },
    title: {
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

// At most one session per course per calendar day.
attendanceSessionSchema.index({ courseId: 1, dateKey: 1 }, { unique: true });

const AttendanceSession = mongoose.model('AttendanceSession', attendanceSessionSchema);

export default AttendanceSession;
