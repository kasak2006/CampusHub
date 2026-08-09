import mongoose from 'mongoose';
import Event from '../models/Event.js';
import Registration from '../models/Registration.js';
import Club from '../models/Club.js';
import asyncHandler from '../utils/asyncHandler.js';
import { uploadImage } from '../utils/uploadImage.js';
import { emitRegistrationUpdate } from '../socket/index.js';

/* ─────────────────────────── helpers ─────────────────────────── */

/** Live count payload for an event (also what we broadcast over sockets). */
function countsOf(event) {
  return {
    registeredCount: event.registeredCount,
    waitlistCount: event.waitlistCount,
    capacity: event.capacity,
    spotsLeft: Math.max(0, event.capacity - event.registeredCount),
    isFull: event.registeredCount >= event.capacity,
    status: event.status,
  };
}

/** Serialize an event (club may be populated) plus the viewer's own status. */
function toPublicEvent(event, viewerStatus) {
  const club = event.clubId;
  const clubPopulated = club && club._id;
  return {
    id: event._id,
    title: event.title,
    description: event.description,
    bannerUrl: event.bannerUrl,
    location: event.location,
    startAt: event.startAt,
    endAt: event.endAt,
    status: event.status,
    createdBy: event.createdBy,
    club: clubPopulated
      ? { id: club._id, name: club.name, logoUrl: club.logoUrl, category: club.category }
      : { id: club },
    ...countsOf(event),
    viewerStatus: viewerStatus ?? null, // 'registered' | 'waitlisted' | null
  };
}

/** True if the user leads the given club, or is a college admin. */
async function canManageClub(clubId, user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const club = await Club.findById(clubId).select('leadIds');
  if (!club) return false;
  return club.leadIds.some((l) => String(l) === String(user.id));
}

/**
 * Promote waitlisted registrations into open seats, oldest first, until the
 * event is full or the waitlist is empty. Each seat is claimed with an atomic
 * conditional `$inc` so this is safe against concurrent cancels/promotions.
 * Used on cancel (a seat freed) and on capacity increase (new seats).
 */
async function promoteFromWaitlist(eventId) {
  // Guard against pathological loops; capacity is bounded in practice.
  for (let i = 0; i < 1000; i += 1) {
    const seat = await Event.findOneAndUpdate(
      {
        _id: eventId,
        status: 'scheduled',
        waitlistCount: { $gt: 0 },
        $expr: { $lt: ['$registeredCount', '$capacity'] },
      },
      { $inc: { registeredCount: 1, waitlistCount: -1 } },
      { new: true }
    );
    if (!seat) break;

    const promoted = await Registration.findOneAndUpdate(
      { eventId, status: 'waitlisted' },
      { $set: { status: 'registered' }, $unset: { waitlistedAt: 1 } },
      { sort: { waitlistedAt: 1 }, new: true }
    );
    if (!promoted) {
      // Counter said there was a waitlister but none found — roll back and stop.
      await Event.updateOne(
        { _id: eventId },
        { $inc: { registeredCount: -1, waitlistCount: 1 } }
      );
      break;
    }
  }
  return Event.findById(eventId);
}

/** Look up the viewer's active status for a set of events. */
async function viewerStatusMap(eventIds, userId) {
  const regs = await Registration.find({
    eventId: { $in: eventIds },
    userId,
    status: { $in: ['registered', 'waitlisted'] },
  }).select('eventId status');
  const map = new Map();
  for (const r of regs) map.set(String(r.eventId), r.status);
  return map;
}

/* ─────────────────────────── events CRUD ─────────────────────────── */

/**
 * GET /api/events        — all scheduled+cancelled events in the college
 * GET /api/events?clubId= — events for one club
 * Sorted by start time. Annotated with the viewer's registration status.
 */
export const listEvents = asyncHandler(async (req, res) => {
  const filter = { collegeId: req.user.collegeId };
  if (req.query.clubId && mongoose.isValidObjectId(req.query.clubId)) {
    filter.clubId = req.query.clubId;
  }

  const events = await Event.find(filter)
    .populate('clubId', 'name logoUrl category')
    .sort({ startAt: 1 });

  const statusMap = await viewerStatusMap(
    events.map((e) => e._id),
    req.user.id
  );

  res.json({
    events: events.map((e) => toPublicEvent(e, statusMap.get(String(e._id)))),
  });
});

/**
 * POST /api/events
 * Create an event for a club. Restricted to a lead of that club (or admin).
 */
export const createEvent = asyncHandler(async (req, res, next) => {
  const { clubId, title, description, location, startAt, endAt, capacity, banner } = req.body;

  if (!mongoose.isValidObjectId(clubId)) {
    res.status(400);
    return next(new Error('A valid clubId is required.'));
  }
  if (!title || !title.trim()) {
    res.status(400);
    return next(new Error('Event title is required.'));
  }
  if (!startAt || Number.isNaN(Date.parse(startAt))) {
    res.status(400);
    return next(new Error('A valid start time is required.'));
  }
  const cap = Number(capacity);
  if (!Number.isInteger(cap) || cap < 1) {
    res.status(400);
    return next(new Error('Capacity must be a whole number of at least 1.'));
  }
  if (!(await canManageClub(clubId, req.user))) {
    res.status(403);
    return next(new Error('Only a lead of this club (or an admin) can create events.'));
  }

  let bannerUrl = '';
  if (banner) bannerUrl = await uploadImage(banner, 'events');

  const event = await Event.create({
    clubId,
    title: title.trim(),
    description: description?.trim() ?? '',
    location: location?.trim() ?? '',
    startAt: new Date(startAt),
    endAt: endAt && !Number.isNaN(Date.parse(endAt)) ? new Date(endAt) : undefined,
    capacity: cap,
    bannerUrl,
    collegeId: req.user.collegeId,
    createdBy: req.user.id,
  });

  const populated = await event.populate('clubId', 'name logoUrl category');
  res.status(201).json({ event: toPublicEvent(populated, null) });
});

/** GET /api/events/:id — detail with club info, counts, viewer status. */
export const getEvent = asyncHandler(async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400);
    return next(new Error('Invalid event id.'));
  }
  const event = await Event.findById(req.params.id).populate(
    'clubId',
    'name logoUrl category leadIds'
  );
  if (!event) {
    res.status(404);
    return next(new Error('Event not found.'));
  }

  const reg = await Registration.findOne({
    eventId: event._id,
    userId: req.user.id,
    status: { $in: ['registered', 'waitlisted'] },
  }).select('status');

  const dto = toPublicEvent(event, reg?.status ?? null);
  // Expose whether the viewer can manage (lead of the club or admin).
  const leadIds = event.clubId?.leadIds ?? [];
  dto.canManage =
    req.user.role === 'admin' || leadIds.some((l) => String(l) === String(req.user.id));
  res.json({ event: dto });
});

/**
 * PATCH /api/events/:id
 * Edit event fields. Lead of the club or admin. Increasing capacity promotes
 * waitlisted students into the new seats; the new counts are broadcast live.
 */
export const updateEvent = asyncHandler(async (req, res, next) => {
  const event = await Event.findById(req.params.id);
  if (!event) {
    res.status(404);
    return next(new Error('Event not found.'));
  }
  if (!(await canManageClub(event.clubId, req.user))) {
    res.status(403);
    return next(new Error('Only a lead of this club (or an admin) can edit this event.'));
  }

  const { title, description, location, startAt, endAt, capacity, banner } = req.body;

  if (title !== undefined) {
    if (!title.trim()) {
      res.status(400);
      return next(new Error('Event title cannot be empty.'));
    }
    event.title = title.trim();
  }
  if (description !== undefined) event.description = description.trim();
  if (location !== undefined) event.location = location.trim();
  if (startAt !== undefined) {
    if (Number.isNaN(Date.parse(startAt))) {
      res.status(400);
      return next(new Error('Invalid start time.'));
    }
    event.startAt = new Date(startAt);
  }
  if (endAt !== undefined) {
    event.endAt = endAt && !Number.isNaN(Date.parse(endAt)) ? new Date(endAt) : undefined;
  }

  let capacityIncreased = false;
  if (capacity !== undefined) {
    const cap = Number(capacity);
    if (!Number.isInteger(cap) || cap < 1) {
      res.status(400);
      return next(new Error('Capacity must be a whole number of at least 1.'));
    }
    if (cap < event.registeredCount) {
      res.status(400);
      return next(
        new Error(`Capacity can't be below the ${event.registeredCount} already registered.`)
      );
    }
    capacityIncreased = cap > event.capacity;
    event.capacity = cap;
  }
  if (banner) event.bannerUrl = await uploadImage(banner, 'events');

  await event.save();

  let fresh = event;
  if (capacityIncreased) fresh = await promoteFromWaitlist(event._id);

  const populated = await Event.findById(fresh._id).populate('clubId', 'name logoUrl category');
  emitRegistrationUpdate(event._id, countsOf(populated));
  res.json({ event: toPublicEvent(populated, null) });
});

/**
 * POST /api/events/:id/cancel
 * Cancel an event (soft — status flips to 'cancelled'). Lead of club or admin.
 */
export const cancelEvent = asyncHandler(async (req, res, next) => {
  const event = await Event.findById(req.params.id);
  if (!event) {
    res.status(404);
    return next(new Error('Event not found.'));
  }
  if (!(await canManageClub(event.clubId, req.user))) {
    res.status(403);
    return next(new Error('Only a lead of this club (or an admin) can cancel this event.'));
  }
  if (event.status === 'cancelled') {
    res.status(409);
    return next(new Error('This event is already cancelled.'));
  }

  event.status = 'cancelled';
  await event.save();
  emitRegistrationUpdate(event._id, countsOf(event));
  res.json({ message: 'Event cancelled.' });
});

/* ─────────────────────────── registration ─────────────────────────── */

/**
 * POST /api/events/:id/register
 * Register the current user. Claims a seat with an atomic conditional `$inc`
 * (`registeredCount < capacity`) so two students can't take the last seat at
 * once; if the event is full, the user is waitlisted. Broadcasts the new count.
 */
export const registerForEvent = asyncHandler(async (req, res, next) => {
  const event = await Event.findById(req.params.id);
  if (!event) {
    res.status(404);
    return next(new Error('Event not found.'));
  }
  if (event.status !== 'scheduled') {
    res.status(409);
    return next(new Error('This event is not open for registration.'));
  }
  if (event.startAt.getTime() <= Date.now()) {
    res.status(409);
    return next(new Error('Registration has closed — the event has already started.'));
  }

  const existing = await Registration.findOne({ eventId: event._id, userId: req.user.id });
  if (existing && existing.status !== 'cancelled') {
    res.status(409);
    return next(new Error(`You are already ${existing.status} for this event.`));
  }

  // Atomically claim a seat only if there's room (compares two fields via $expr).
  const claimed = await Event.findOneAndUpdate(
    { _id: event._id, status: 'scheduled', $expr: { $lt: ['$registeredCount', '$capacity'] } },
    { $inc: { registeredCount: 1 } },
    { new: true }
  );

  let status;
  let resultEvent;
  if (claimed) {
    status = 'registered';
    resultEvent = claimed;
  } else {
    status = 'waitlisted';
    resultEvent = await Event.findOneAndUpdate(
      { _id: event._id, status: 'scheduled' },
      { $inc: { waitlistCount: 1 } },
      { new: true }
    );
  }

  const fields = {
    status,
    waitlistedAt: status === 'waitlisted' ? new Date() : undefined,
  };
  if (existing) {
    existing.set(fields);
    if (status !== 'waitlisted') existing.waitlistedAt = undefined;
    await existing.save();
  } else {
    await Registration.create({
      eventId: event._id,
      userId: req.user.id,
      collegeId: event.collegeId,
      ...fields,
    });
  }

  emitRegistrationUpdate(event._id, countsOf(resultEvent));
  // `registrationStatus` (not `status`) so it isn't shadowed by the event's own
  // status inside countsOf().
  res.status(201).json({ registrationStatus: status, ...countsOf(resultEvent) });
});

/**
 * DELETE /api/events/:id/register
 * Cancel the current user's registration. If they held a seat, it's freed and
 * the oldest waitlisted student is promoted. Broadcasts the new count.
 */
export const cancelRegistration = asyncHandler(async (req, res, next) => {
  const event = await Event.findById(req.params.id);
  if (!event) {
    res.status(404);
    return next(new Error('Event not found.'));
  }

  const reg = await Registration.findOne({ eventId: event._id, userId: req.user.id });
  if (!reg || reg.status === 'cancelled') {
    res.status(409);
    return next(new Error('You are not registered for this event.'));
  }

  const wasRegistered = reg.status === 'registered';
  reg.status = 'cancelled';
  reg.waitlistedAt = undefined;
  await reg.save();

  if (wasRegistered) {
    await Event.updateOne({ _id: event._id }, { $inc: { registeredCount: -1 } });
    await promoteFromWaitlist(event._id);
  } else {
    await Event.updateOne({ _id: event._id }, { $inc: { waitlistCount: -1 } });
  }

  const fresh = await Event.findById(event._id);
  emitRegistrationUpdate(event._id, countsOf(fresh));
  res.json({ registrationStatus: 'cancelled', ...countsOf(fresh) });
});

/**
 * GET /api/events/:id/registrations
 * Roster for the club lead's live dashboard: registered + waitlisted students,
 * in join order. Lead of the club or admin only.
 */
export const listEventRegistrations = asyncHandler(async (req, res, next) => {
  const event = await Event.findById(req.params.id);
  if (!event) {
    res.status(404);
    return next(new Error('Event not found.'));
  }
  if (!(await canManageClub(event.clubId, req.user))) {
    res.status(403);
    return next(new Error('Only a lead of this club (or an admin) can view registrations.'));
  }

  const regs = await Registration.find({
    eventId: event._id,
    status: { $in: ['registered', 'waitlisted'] },
  })
    .populate('userId', 'name email rollNumber department')
    .sort({ status: 1, waitlistedAt: 1, createdAt: 1 });

  res.json({
    counts: countsOf(event),
    registrations: regs.map((r) => ({
      id: r._id,
      status: r.status,
      createdAt: r.createdAt,
      user: r.userId
        ? {
            id: r.userId._id,
            name: r.userId.name,
            email: r.userId.email,
            rollNumber: r.userId.rollNumber,
            department: r.userId.department,
          }
        : null,
    })),
  });
});
