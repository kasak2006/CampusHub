import mongoose from 'mongoose';
import Announcement from '../models/Announcement.js';
import Club from '../models/Club.js';
import Course from '../models/Course.js';
import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';
import { notifyUsers } from '../utils/notify.js';

/* ─────────────────────────── helpers ─────────────────────────── */

/** Serialize an announcement (author may be populated) for the client. */
function toPublicAnnouncement(a, viewer) {
  const author = a.authorId;
  const authorPopulated = author && author._id;
  return {
    id: a._id,
    scope: a.scope,
    targetId: a.targetId,
    title: a.title,
    body: a.body,
    pinned: a.pinned,
    createdAt: a.createdAt,
    author: authorPopulated
      ? { id: author._id, name: author.name, role: author.role, avatarUrl: author.avatarUrl }
      : { id: author },
    canManage: viewer
      ? viewer.role === 'admin' || String(author?._id ?? author) === String(viewer.id)
      : false,
  };
}

/** The set of club and course ids a user belongs to (for read visibility). */
async function membershipIdsFor(user) {
  const [clubs, courses] = await Promise.all([
    Club.find({ collegeId: user.collegeId, memberIds: user.id }).select('_id'),
    Course.find({
      collegeId: user.collegeId,
      $or: [{ studentIds: user.id }, { facultyId: user.id }],
    }).select('_id'),
  ]);
  return {
    clubIds: clubs.map((c) => c._id),
    courseIds: courses.map((c) => c._id),
  };
}

/**
 * Whether a user may post to a given scope/target.
 *   college → faculty or admin
 *   club    → a lead of that club, or admin
 *   course  → that course's faculty, or admin
 */
async function canPostTo(scope, targetId, user) {
  if (user.role === 'admin') return true;
  if (scope === 'college') return user.role === 'faculty';
  if (scope === 'club') {
    const club = await Club.findById(targetId).select('leadIds');
    return Boolean(club && club.leadIds.some((l) => String(l) === String(user.id)));
  }
  if (scope === 'course') {
    const course = await Course.findById(targetId).select('facultyId');
    return Boolean(course && String(course.facultyId) === String(user.id));
  }
  return false;
}

/**
 * The recipients of an announcement (everyone in its audience). Deduping and
 * author-exclusion happen in notifyUsers.
 */
async function recipientsFor(scope, targetId, collegeId) {
  if (scope === 'college') {
    const users = await User.find({ collegeId }).select('_id');
    return users.map((u) => u._id);
  }
  if (scope === 'club') {
    const club = await Club.findById(targetId).select('memberIds leadIds');
    if (!club) return [];
    return [...club.memberIds, ...club.leadIds];
  }
  if (scope === 'course') {
    const course = await Course.findById(targetId).select('studentIds facultyId');
    if (!course) return [];
    return [...course.studentIds, course.facultyId];
  }
  return [];
}

/* ─────────────────────────── announcements ─────────────────────────── */

/**
 * GET /api/announcements
 * The viewer's feed: college-wide announcements plus any for a club or course
 * they belong to. Pinned first, then newest. Requires `protect`.
 */
export const listAnnouncements = asyncHandler(async (req, res) => {
  const { clubIds, courseIds } = await membershipIdsFor(req.user);

  const announcements = await Announcement.find({
    collegeId: req.user.collegeId,
    $or: [
      { scope: 'college' },
      { scope: 'club', targetId: { $in: clubIds } },
      { scope: 'course', targetId: { $in: courseIds } },
    ],
  })
    .populate('authorId', 'name role avatarUrl')
    .sort({ pinned: -1, createdAt: -1 })
    .limit(100);

  res.json({ announcements: announcements.map((a) => toPublicAnnouncement(a, req.user)) });
});

/**
 * POST /api/announcements
 * Post an announcement and fan a notification out to its audience. Permission
 * depends on scope (see canPostTo). Requires `protect`.
 */
export const createAnnouncement = asyncHandler(async (req, res, next) => {
  const { scope, targetId, title, body, pinned } = req.body;

  if (!['college', 'club', 'course'].includes(scope)) {
    res.status(400);
    return next(new Error("Scope must be 'college', 'club', or 'course'."));
  }
  if (!title || !title.trim()) {
    res.status(400);
    return next(new Error('Announcement title is required.'));
  }
  if (!body || !body.trim()) {
    res.status(400);
    return next(new Error('Announcement body is required.'));
  }
  if (scope !== 'college' && !mongoose.isValidObjectId(targetId)) {
    res.status(400);
    return next(new Error('A valid club or course must be selected for this scope.'));
  }

  if (!(await canPostTo(scope, targetId, req.user))) {
    res.status(403);
    return next(new Error('You do not have permission to post to this audience.'));
  }

  const announcement = await Announcement.create({
    scope,
    targetId: scope === 'college' ? null : targetId,
    title: title.trim(),
    body: body.trim(),
    pinned: Boolean(pinned),
    authorId: req.user.id,
    collegeId: req.user.collegeId,
  });

  // Fan out notifications to the audience (excluding the author).
  const recipients = (await recipientsFor(scope, targetId, req.user.collegeId)).filter(
    (id) => String(id) !== String(req.user.id)
  );
  await notifyUsers(recipients, {
    type: 'announcement',
    refId: announcement._id,
    text: `New announcement: ${announcement.title}`,
    link: '/announcements',
    collegeId: req.user.collegeId,
  });

  const populated = await announcement.populate('authorId', 'name role avatarUrl');
  res.status(201).json({ announcement: toPublicAnnouncement(populated, req.user) });
});

/**
 * PATCH /api/announcements/:id
 * Edit the title/body or toggle pinned. Author or admin only. Requires `protect`.
 */
export const updateAnnouncement = asyncHandler(async (req, res, next) => {
  const announcement = await Announcement.findById(req.params.id);
  if (!announcement) {
    res.status(404);
    return next(new Error('Announcement not found.'));
  }
  const isOwner = String(announcement.authorId) === String(req.user.id);
  if (!isOwner && req.user.role !== 'admin') {
    res.status(403);
    return next(new Error('Only the author or an admin can edit this announcement.'));
  }

  const { title, body, pinned } = req.body;
  if (title !== undefined) {
    if (!title.trim()) {
      res.status(400);
      return next(new Error('Announcement title cannot be empty.'));
    }
    announcement.title = title.trim();
  }
  if (body !== undefined) {
    if (!body.trim()) {
      res.status(400);
      return next(new Error('Announcement body cannot be empty.'));
    }
    announcement.body = body.trim();
  }
  if (pinned !== undefined) announcement.pinned = Boolean(pinned);

  await announcement.save();
  const populated = await announcement.populate('authorId', 'name role avatarUrl');
  res.json({ announcement: toPublicAnnouncement(populated, req.user) });
});

/**
 * DELETE /api/announcements/:id
 * Remove an announcement. Author or admin only. Requires `protect`.
 */
export const deleteAnnouncement = asyncHandler(async (req, res, next) => {
  const announcement = await Announcement.findById(req.params.id);
  if (!announcement) {
    res.status(404);
    return next(new Error('Announcement not found.'));
  }
  const isOwner = String(announcement.authorId) === String(req.user.id);
  if (!isOwner && req.user.role !== 'admin') {
    res.status(403);
    return next(new Error('Only the author or an admin can delete this announcement.'));
  }

  await announcement.deleteOne();
  res.json({ message: 'Announcement deleted.' });
});
