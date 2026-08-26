import Course from '../models/Course.js';
import Event from '../models/Event.js';
import Registration from '../models/Registration.js';
import AttendanceSession from '../models/AttendanceSession.js';
import Assignment from '../models/Assignment.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * Calendar aggregation (Phase 8). One read that merges, for the current user,
 * the three kinds of dated things the app already produces — no new model:
 *
 *   event   → an Event the user has an active Registration for
 *   session → an AttendanceSession of a course they teach or are enrolled in
 *   due     → an Assignment due date on one of those same courses
 *
 * Everything is scoped by the user's own relationships (their registrations,
 * the courses they teach/take), so no extra collegeId filter is needed. Items
 * come back normalized to { type, title, when, refId, url, meta } and sorted by
 * `when`, ready for the client to bucket into day cells.
 */

const DEFAULT_WINDOW_DAYS = 42; // a month grid can show up to 6 weeks.

/** Parse a query date, falling back to `fallback` when absent/invalid. */
function parseDate(value, fallback) {
  if (!value) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

/**
 * GET /api/calendar?from=&to=
 * Merge the current user's registered events, class sessions, and assignment
 * due dates within [from, to] into one normalized, time-sorted list.
 */
export const getCalendar = asyncHandler(async (req, res, next) => {
  const now = new Date();
  const from = parseDate(req.query.from, new Date(now.getFullYear(), now.getMonth(), 1));
  const to = parseDate(
    req.query.to,
    new Date(from.getTime() + DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  );
  if (from > to) {
    res.status(400);
    return next(new Error('`from` must be on or before `to`.'));
  }

  const userId = req.user.id;

  // Courses the user teaches or is enrolled in — the context for sessions + dues.
  const courses = await Course.find({
    $or: [{ facultyId: userId }, { studentIds: userId }],
  }).select('_id code name');
  const courseIds = courses.map((c) => c._id);
  const courseById = new Map(courses.map((c) => [String(c._id), c]));

  // Events the user has an active spot in (registered or waitlisted).
  const registrations = await Registration.find({
    userId,
    status: { $in: ['registered', 'waitlisted'] },
  }).select('eventId');
  const eventIds = registrations.map((r) => r.eventId);

  const [events, sessions, assignments] = await Promise.all([
    eventIds.length
      ? Event.find({
          _id: { $in: eventIds },
          status: 'scheduled',
          startAt: { $gte: from, $lte: to },
        })
          .select('title startAt location clubId')
          .populate('clubId', 'name')
      : [],
    courseIds.length
      ? AttendanceSession.find({
          courseId: { $in: courseIds },
          date: { $gte: from, $lte: to },
        }).select('title date courseId')
      : [],
    courseIds.length
      ? Assignment.find({
          courseId: { $in: courseIds },
          dueAt: { $gte: from, $lte: to },
        }).select('title dueAt courseId points')
      : [],
  ]);

  const items = [];

  for (const e of events) {
    items.push({
      type: 'event',
      title: e.title,
      when: e.startAt,
      refId: e._id,
      url: `/events/${e._id}`,
      meta: { location: e.location || '', club: e.clubId?.name || '' },
    });
  }

  for (const s of sessions) {
    const course = courseById.get(String(s.courseId));
    items.push({
      type: 'session',
      title: s.title?.trim() || `${course?.code ?? 'Class'} session`,
      when: s.date,
      refId: s._id,
      url: `/sessions/${s._id}`,
      meta: { course: course?.code ?? '' },
    });
  }

  for (const a of assignments) {
    const course = courseById.get(String(a.courseId));
    items.push({
      type: 'due',
      title: a.title,
      when: a.dueAt,
      refId: a._id,
      url: `/assignments/${a._id}`,
      meta: { course: course?.code ?? '', points: a.points },
    });
  }

  items.sort((x, y) => new Date(x.when) - new Date(y.when));

  res.json({
    range: { from, to },
    items,
  });
});

export default getCalendar;
