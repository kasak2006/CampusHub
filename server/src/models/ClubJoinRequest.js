import mongoose from 'mongoose';
import env from '../config/env.js';

/**
 * ClubJoinRequest — a student's request to join a club (Phase 2).
 *
 * One document per (club, user): the record is reused across re-requests, so a
 * student who was rejected can request again and the same row transitions back
 * to `pending`. Approval adds the user to Club.memberIds (see clubController).
 */
const clubJoinRequestSchema = new mongoose.Schema(
  {
    clubId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Club',
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
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    message: {
      type: String,
      default: '',
      trim: true,
      maxlength: [280, 'Message must be 280 characters or fewer.'],
    },
    decidedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    decidedAt: {
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

// At most one request document per user per club.
clubJoinRequestSchema.index({ clubId: 1, userId: 1 }, { unique: true });

const ClubJoinRequest = mongoose.model('ClubJoinRequest', clubJoinRequestSchema);

export default ClubJoinRequest;
