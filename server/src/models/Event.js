import mongoose from 'mongoose';
import env from '../config/env.js';

/**
 * Event — something a club runs that students register for (Phase 3).
 *
 * Capacity handling: `registeredCount` is a denormalized counter maintained via
 * atomic conditional `$inc` so two students can't claim the last seat at once
 * (see eventController.registerForEvent). Registration documents remain the
 * source of truth; this counter is the fast, race-safe gate. `waitlistCount`
 * tracks overflow once the event is full.
 */
const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Event title is required.'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    clubId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Club',
      required: true,
      index: true,
    },
    bannerUrl: {
      type: String,
      default: '',
    },
    location: {
      type: String,
      default: '',
      trim: true,
    },
    startAt: {
      type: Date,
      required: [true, 'Event start time is required.'],
    },
    endAt: {
      type: Date,
    },
    capacity: {
      type: Number,
      required: [true, 'Capacity is required.'],
      min: [1, 'Capacity must be at least 1.'],
    },
    registeredCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    waitlistCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ['scheduled', 'cancelled'],
      default: 'scheduled',
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

eventSchema.index({ collegeId: 1, startAt: 1 });

const Event = mongoose.model('Event', eventSchema);

export default Event;
