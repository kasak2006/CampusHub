import mongoose from 'mongoose';
import env from '../config/env.js';

/**
 * AttendanceRecord — one student's mark for one session (Phase 4).
 *
 * One document per (session, student), enforced by the unique compound index so
 * re-submitting a session's marks updates rather than duplicates. `courseId` is
 * denormalized off the session so per-course analytics can aggregate records
 * directly without joining through sessions.
 *
 * Attendance math: `present` and `late` both count as attended; `absent` (or the
 * absence of any record) does not. See attendanceController.
 */
const attendanceRecordSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AttendanceSession',
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
    status: {
      type: String,
      enum: ['present', 'late', 'absent'],
      default: 'absent',
    },
    collegeId: {
      type: String,
      default: env.defaultCollegeId,
      index: true,
    },
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

// At most one record per student per session.
attendanceRecordSchema.index({ sessionId: 1, studentId: 1 }, { unique: true });

const AttendanceRecord = mongoose.model('AttendanceRecord', attendanceRecordSchema);

export default AttendanceRecord;
