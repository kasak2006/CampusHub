import mongoose from 'mongoose';
import Club from '../models/Club.js';
import ClubJoinRequest from '../models/ClubJoinRequest.js';
import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';
import { uploadImage } from '../utils/uploadImage.js';

/* ─────────────────────────── helpers ─────────────────────────── */

/** Serialize a populated (or raw) club for the client. */
function toPublicClub(club, viewerId) {
  const leadIds = club.leadIds.map((l) => String(l._id ?? l));
  const memberIds = club.memberIds.map((m) => String(m._id ?? m));
  const viewer = viewerId ? String(viewerId) : null;

  return {
    id: club._id,
    name: club.name,
    description: club.description,
    category: club.category,
    logoUrl: club.logoUrl,
    collegeId: club.collegeId,
    createdBy: club.createdBy,
    createdAt: club.createdAt,
    memberCount: memberIds.length,
    leadCount: leadIds.length,
    // Only include the actual member/lead objects when they've been populated.
    leads: club.leadIds.some((l) => l._id) ? club.leadIds.map(toPublicMember) : undefined,
    members: club.memberIds.some((m) => m._id)
      ? club.memberIds.map(toPublicMember)
      : undefined,
    viewer: viewer
      ? {
          isLead: leadIds.includes(viewer),
          isMember: memberIds.includes(viewer),
        }
      : undefined,
  };
}

/** Trim a populated User down to safe member fields. */
function toPublicMember(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    rollNumber: user.rollNumber,
    department: user.department,
    avatarUrl: user.avatarUrl,
  };
}

/** True if the user leads this club or is a college admin. */
function canManage(club, user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return club.leadIds.some((l) => String(l._id ?? l) === String(user.id));
}

/**
 * Keep a user's global `role` in sync with whether they lead any club.
 * Promotes student → club_lead when they gain a lead role; demotes club_lead →
 * student when they lead zero clubs. Never touches faculty/admin.
 */
async function syncLeadRole(userId) {
  const user = await User.findById(userId);
  if (!user || user.role === 'faculty' || user.role === 'admin') return;

  const leadCount = await Club.countDocuments({ leadIds: userId });
  const nextRole = leadCount > 0 ? 'club_lead' : 'student';
  if (user.role !== nextRole) {
    user.role = nextRole;
    await user.save();
  }
}

/* ─────────────────────────── clubs CRUD ─────────────────────────── */

/**
 * GET /api/clubs
 * List all clubs in the college with counts and the viewer's relationship to
 * each (member / lead / pending request). Requires `protect`.
 */
export const listClubs = asyncHandler(async (req, res) => {
  const clubs = await Club.find({ collegeId: req.user.collegeId }).sort({ name: 1 });

  // Pull the viewer's pending requests in one query to annotate the list.
  const pending = await ClubJoinRequest.find({
    userId: req.user.id,
    status: 'pending',
  }).select('clubId');
  const pendingClubIds = new Set(pending.map((r) => String(r.clubId)));

  const payload = clubs.map((club) => {
    const dto = toPublicClub(club, req.user.id);
    dto.viewer.hasPendingRequest = pendingClubIds.has(String(club._id));
    return dto;
  });

  res.json({ clubs: payload });
});

/**
 * POST /api/clubs
 * Self-service club creation: any authenticated user may create a club. The
 * creator becomes the first lead + a member, and (if a student) is promoted to
 * `club_lead`. See 02-phase-plan.md — creation is self-service by design.
 */
export const createClub = asyncHandler(async (req, res, next) => {
  const { name, description, category, logo } = req.body;

  if (!name || !name.trim()) {
    res.status(400);
    return next(new Error('Club name is required.'));
  }

  const exists = await Club.findOne({
    collegeId: req.user.collegeId,
    name: name.trim(),
  });
  if (exists) {
    res.status(409);
    return next(new Error('A club with that name already exists.'));
  }

  let logoUrl = '';
  if (logo) logoUrl = await uploadImage(logo, 'clubs');

  const club = await Club.create({
    name: name.trim(),
    description: description?.trim() ?? '',
    category: category?.trim() || 'General',
    logoUrl,
    collegeId: req.user.collegeId,
    createdBy: req.user.id,
    leadIds: [req.user.id],
    memberIds: [req.user.id],
  });

  await syncLeadRole(req.user.id);

  res.status(201).json({ club: toPublicClub(club, req.user.id) });
});

/**
 * GET /api/clubs/:id
 * Club detail with populated leads and members. Requires `protect`.
 */
export const getClub = asyncHandler(async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400);
    return next(new Error('Invalid club id.'));
  }

  const club = await Club.findById(req.params.id)
    .populate('leadIds', 'name email role rollNumber department avatarUrl')
    .populate('memberIds', 'name email role rollNumber department avatarUrl');

  if (!club) {
    res.status(404);
    return next(new Error('Club not found.'));
  }

  const dto = toPublicClub(club, req.user.id);
  if (dto.viewer && !dto.viewer.isMember) {
    const pending = await ClubJoinRequest.exists({
      clubId: club._id,
      userId: req.user.id,
      status: 'pending',
    });
    dto.viewer.hasPendingRequest = Boolean(pending);
  }

  res.json({ club: dto });
});

/**
 * PATCH /api/clubs/:id
 * Edit club profile (name, description, category, logo). Lead or admin only.
 */
export const updateClub = asyncHandler(async (req, res, next) => {
  const club = await Club.findById(req.params.id);
  if (!club) {
    res.status(404);
    return next(new Error('Club not found.'));
  }
  if (!canManage(club, req.user)) {
    res.status(403);
    return next(new Error('Only a club lead or admin can edit this club.'));
  }

  const { name, description, category, logo } = req.body;

  if (name !== undefined) {
    const trimmed = name.trim();
    if (!trimmed) {
      res.status(400);
      return next(new Error('Club name cannot be empty.'));
    }
    // Guard the unique (collegeId, name) index with a friendly 409.
    const clash = await Club.findOne({
      collegeId: club.collegeId,
      name: trimmed,
      _id: { $ne: club._id },
    });
    if (clash) {
      res.status(409);
      return next(new Error('A club with that name already exists.'));
    }
    club.name = trimmed;
  }
  if (description !== undefined) club.description = description.trim();
  if (category !== undefined) club.category = category.trim() || 'General';
  if (logo) club.logoUrl = await uploadImage(logo, 'clubs');

  await club.save();
  res.json({ club: toPublicClub(club, req.user.id) });
});

/**
 * DELETE /api/clubs/:id
 * Delete a club. Lead or admin only. Cleans up join requests and re-syncs the
 * global role of anyone who no longer leads a club.
 */
export const deleteClub = asyncHandler(async (req, res, next) => {
  const club = await Club.findById(req.params.id);
  if (!club) {
    res.status(404);
    return next(new Error('Club not found.'));
  }
  if (!canManage(club, req.user)) {
    res.status(403);
    return next(new Error('Only a club lead or admin can delete this club.'));
  }

  const affectedLeads = club.leadIds.map((id) => String(id));
  await ClubJoinRequest.deleteMany({ clubId: club._id });
  await club.deleteOne();

  for (const leadId of affectedLeads) await syncLeadRole(leadId);

  res.json({ message: 'Club deleted.' });
});

/* ─────────────────────────── membership ─────────────────────────── */

/**
 * POST /api/clubs/:id/join
 * Student requests to join. Reuses the one-per-(club,user) request document, so
 * re-requesting after a rejection flips it back to pending. Requires `protect`.
 */
export const requestToJoin = asyncHandler(async (req, res, next) => {
  const club = await Club.findById(req.params.id);
  if (!club) {
    res.status(404);
    return next(new Error('Club not found.'));
  }

  const isMember = club.memberIds.some((m) => String(m) === String(req.user.id));
  if (isMember) {
    res.status(409);
    return next(new Error('You are already a member of this club.'));
  }

  const existing = await ClubJoinRequest.findOne({
    clubId: club._id,
    userId: req.user.id,
  });

  if (existing?.status === 'pending') {
    res.status(409);
    return next(new Error('You already have a pending request for this club.'));
  }

  const message = (req.body.message ?? '').trim();

  const request = existing
    ? Object.assign(existing, {
        status: 'pending',
        message,
        decidedBy: undefined,
        decidedAt: undefined,
      })
    : new ClubJoinRequest({
        clubId: club._id,
        userId: req.user.id,
        message,
        collegeId: club.collegeId,
      });

  await request.save();
  res.status(201).json({ request: { id: request._id, status: request.status } });
});

/**
 * POST /api/clubs/:id/leave
 * A member leaves the club. A lead cannot leave while they're the *only* lead
 * (would orphan the club) — hand off or delete instead. Requires `protect`.
 */
export const leaveClub = asyncHandler(async (req, res, next) => {
  const club = await Club.findById(req.params.id);
  if (!club) {
    res.status(404);
    return next(new Error('Club not found.'));
  }

  const userId = String(req.user.id);
  const isMember = club.memberIds.some((m) => String(m) === userId);
  if (!isMember) {
    res.status(409);
    return next(new Error('You are not a member of this club.'));
  }

  const isLead = club.leadIds.some((l) => String(l) === userId);
  if (isLead && club.leadIds.length === 1) {
    res.status(409);
    return next(
      new Error('You are the only lead — promote another lead or delete the club instead.')
    );
  }

  club.memberIds = club.memberIds.filter((m) => String(m) !== userId);
  club.leadIds = club.leadIds.filter((l) => String(l) !== userId);
  await club.save();
  await syncLeadRole(req.user.id);

  res.json({ message: 'You have left the club.' });
});

/* ─────────────────────────── requests (lead view) ─────────────────────────── */

/**
 * GET /api/clubs/:id/requests
 * Pending join requests for a club (lead/admin only). Requires `protect`.
 */
export const listJoinRequests = asyncHandler(async (req, res, next) => {
  const club = await Club.findById(req.params.id);
  if (!club) {
    res.status(404);
    return next(new Error('Club not found.'));
  }
  if (!canManage(club, req.user)) {
    res.status(403);
    return next(new Error('Only a club lead or admin can view join requests.'));
  }

  const requests = await ClubJoinRequest.find({ clubId: club._id, status: 'pending' })
    .populate('userId', 'name email role rollNumber department avatarUrl')
    .sort({ createdAt: 1 });

  res.json({
    requests: requests.map((r) => ({
      id: r._id,
      status: r.status,
      message: r.message,
      createdAt: r.createdAt,
      user: r.userId ? toPublicMember(r.userId) : null,
    })),
  });
});

/**
 * PATCH /api/clubs/:id/requests/:requestId
 * Approve or reject a join request (lead/admin only). Body: { action }.
 * Approving adds the user to memberIds. Requires `protect`.
 */
export const decideJoinRequest = asyncHandler(async (req, res, next) => {
  const { action } = req.body;
  if (!['approve', 'reject'].includes(action)) {
    res.status(400);
    return next(new Error("Action must be 'approve' or 'reject'."));
  }

  const club = await Club.findById(req.params.id);
  if (!club) {
    res.status(404);
    return next(new Error('Club not found.'));
  }
  if (!canManage(club, req.user)) {
    res.status(403);
    return next(new Error('Only a club lead or admin can decide join requests.'));
  }

  const request = await ClubJoinRequest.findOne({
    _id: req.params.requestId,
    clubId: club._id,
  });
  if (!request) {
    res.status(404);
    return next(new Error('Join request not found.'));
  }
  if (request.status !== 'pending') {
    res.status(409);
    return next(new Error(`This request was already ${request.status}.`));
  }

  request.status = action === 'approve' ? 'approved' : 'rejected';
  request.decidedBy = req.user.id;
  request.decidedAt = new Date();
  await request.save();

  if (action === 'approve') {
    const already = club.memberIds.some((m) => String(m) === String(request.userId));
    if (!already) {
      club.memberIds.push(request.userId);
      await club.save();
    }
  }

  res.json({ request: { id: request._id, status: request.status } });
});

/* ─────────────────────────── lead promotion (admin) ─────────────────────────── */

/**
 * POST /api/clubs/:id/leads
 * Promote a user to lead of this club (admin, or an existing lead of the club).
 * Body: { userId }. The user is added to leadIds + memberIds and, if a student,
 * promoted to the club_lead role. Requires `protect`.
 */
export const addClubLead = asyncHandler(async (req, res, next) => {
  const { userId } = req.body;
  if (!mongoose.isValidObjectId(userId)) {
    res.status(400);
    return next(new Error('A valid userId is required.'));
  }

  const club = await Club.findById(req.params.id);
  if (!club) {
    res.status(404);
    return next(new Error('Club not found.'));
  }
  if (!canManage(club, req.user)) {
    res.status(403);
    return next(new Error('Only a club lead or admin can promote a lead.'));
  }

  const target = await User.findById(userId);
  if (!target) {
    res.status(404);
    return next(new Error('User not found.'));
  }

  if (!club.leadIds.some((l) => String(l) === String(userId))) {
    club.leadIds.push(userId);
  }
  if (!club.memberIds.some((m) => String(m) === String(userId))) {
    club.memberIds.push(userId);
  }
  await club.save();
  await syncLeadRole(userId);

  res.json({ message: `${target.name} is now a lead of ${club.name}.` });
});
