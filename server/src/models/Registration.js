import mongoose from 'mongoose';
import env from '../config/env.js';

/**
 * Registration — a student's spot in an event (Phase 3).
 *
 * One document per (event, user): the record is reused across cancel/re-register
 * (status transitions), enforced by the unique compound index. `registered` and
 * `waitlisted` are active states; `cancelled` frees the seat.
 */
const registrationSchema = new mongoose.Schema(
  {
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['registered', 'waitlisted', 'cancelled'],
      default: 'registered',
    },
    // When the user joined the waitlist — used to promote in FIFO order.
    waitlistedAt: {
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

// At most one registration document per user per event.
registrationSchema.index({ eventId: 1, userId: 1 }, { unique: true });

const Registration = mongoose.model('Registration', registrationSchema);

export default Registration;
