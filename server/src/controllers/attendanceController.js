import mongoose from 'mongoose';
import Course from '../models/Course.js';
import AttendanceSession from '../models/AttendanceSession.js';
import AttendanceRecord from '../models/AttendanceRecord.js';
import asyncHandler from '../utils/asyncHandler.js';

/* ─────────────────────────── helpers ─────────────────────────── */

const VALID_STATUSES = ['present', 'late', 'absent'];

/** True if the user owns the course (its faculty) or is a college admin. */
function canManageCourse(course, user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return String(course.facultyId) === String(user.id);
}

/**
 * Normalize a date input to a calendar-day key ('YYYY-MM-DD'). Accepts the
 * 'YYYY-MM-DD' emitted by <input type="date"> as well as any parseable date.
 * Returns null if the input isn't a usable date.
 */
function dayKeyOf(input) {
  const s = String(input ?? '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** Load a session and its course, or send the right error. */
async function loadSessionAndCourse(id, res, next) {
  if (!mongoose.isValidObjectId(id)) {
    res.status(400);
    next(new Error('Invalid session id.'));
    return null;
  }
  const session = await AttendanceSession.findById(id);
  if (!session) {
    res.status(404);
    next(new Error('Attendance session not found.'));
    return null;
  }
  const course = await Course.findById(session.courseId).populate(
    'studentIds',
    'name email rollNumber department avatarUrl'
  );
  if (!course) {
    res.status(404);
    next(new Error('Course not found.'));
    return null;
  }
  return { session, course };
}

/** Session summary counts from its records. */
function summarize(records) {
  const counts = { present: 0, late: 0, absent: 0 };
  for (const r of records) counts[r.status] += 1;
  return counts;
}

/* ─────────────────────────── sessions ─────────────────────────── */

/**
 * GET /api/attendance/sessions?courseId=
 * Sessions for a course, newest first. Owner faculty/admin see how many students
 * were marked in each; an enrolled student sees their own status per session.
 */
export const listSessions = asyncHandler(async (req, res, next) => {
  const { courseId } = req.query;
  if (!mongoose.isValidObjectId(courseId)) {
    res.status(400);
    return next(new Error('A valid courseId is required.'));
  }
  const course = await Course.findById(courseId);
  if (!course) {
    res.status(404);
    return next(new Error('Course not found.'));
  }

  const manage = canManageCourse(course, req.user);
  const enrolled = course.studentIds.some((s) => String(s) === String(req.user.id));
  if (!manage && !enrolled) {
    res.status(403);
    return next(new Error('You do not have access to this course.'));
  }

  const sessions = await AttendanceSession.find({ courseId }).sort({ date: -1 });
  const sessionIds = sessions.map((s) => s._id);

  // Fetch the records we need in one query: all for a manager, just the
  // viewer's own for a student.
  const recordFilter = { sessionId: { $in: sessionIds } };
  if (!manage) recordFilter.studentId = req.user.id;
  const records = await AttendanceRecord.find(recordFilter).select('sessionId studentId status');

  const bySession = new Map();
  for (const r of records) {
    const key = String(r.sessionId);
    if (!bySession.has(key)) bySession.set(key, []);
    bySession.get(key).push(r);
  }

  const payload = sessions.map((s) => {
    const recs = bySession.get(String(s._id)) ?? [];
    const base = {
      id: s._id,
      date: s.date,
      dateKey: s.dateKey,
      title: s.title,
      createdAt: s.createdAt,
    };
    if (manage) {
      const counts = summarize(recs);
      return {
        ...base,
        marked: recs.length,
        enrolled: course.studentIds.length,
        ...counts,
      };
    }
    return { ...base, myStatus: recs[0]?.status ?? null };
  });

  res.json({ sessions: payload });
});

/**
 * POST /api/attendance/sessions
 * Create a session for a course on a date. The unique {courseId, dateKey} index
 * prevents a second session for the same day (edit the existing one instead).
 * Owner faculty or admin only.
 */
export const createSession = asyncHandler(async (req, res, next) => {
  const { courseId, date, title } = req.body;
  if (!mongoose.isValidObjectId(courseId)) {
    res.status(400);
    return next(new Error('A valid courseId is required.'));
  }
  const dateKey = dayKeyOf(date);
  if (!dateKey) {
    res.status(400);
    return next(new Error('A valid session date is required.'));
  }

  const course = await Course.findById(courseId);
  if (!course) {
    res.status(404);
    return next(new Error('Course not found.'));
  }
  if (!canManageCourse(course, req.user)) {
    res.status(403);
    return next(new Error('Only the course faculty or an admin can create sessions.'));
  }

  const existing = await AttendanceSession.findOne({ courseId, dateKey });
  if (existing) {
    res.status(409);
    return next(new Error('A session already exists for that date — edit it instead.'));
  }

  const session = await AttendanceSession.create({
    courseId,
    date: new Date(`${dateKey}T00:00:00.000Z`),
    dateKey,
    title: title?.trim() ?? '',
    collegeId: course.collegeId,
    createdBy: req.user.id,
  });

  res.status(201).json({
    session: { id: session._id, date: session.date, dateKey: session.dateKey, title: session.title },
  });
});

/**
 * GET /api/attendance/sessions/:id
 * The marking roster: every enrolled student with their current mark for this
 * session (null = not yet marked). Owner faculty or admin only.
 */
export const getSession = asyncHandler(async (req, res, next) => {
  const loaded = await loadSessionAndCourse(req.params.id, res, next);
  if (!loaded) return;
  const { session, course } = loaded;

  if (!canManageCourse(course, req.user)) {
    res.status(403);
    return next(new Error('Only the course faculty or an admin can view this session.'));
  }

  const records = await AttendanceRecord.find({ sessionId: session._id }).select(
    'studentId status'
  );
  const statusBy = new Map(records.map((r) => [String(r.studentId), r.status]));

  const roster = course.studentIds.map((student) => ({
    student: {
      id: student._id,
      name: student.name,
      email: student.email,
      rollNumber: student.rollNumber,
      department: student.department,
      avatarUrl: student.avatarUrl,
    },
    status: statusBy.get(String(student._id)) ?? null,
  }));

  res.json({
    session: { id: session._id, date: session.date, dateKey: session.dateKey, title: session.title },
    course: { id: course._id, name: course.name, code: course.code },
    roster,
    counts: summarize(records),
  });
});

/**
 * PATCH /api/attendance/sessions/:id
 * Submit / update marks. Body: { records: [{ studentId, status }] }. Each entry
 * is upserted (unique per session+student) so re-submitting overwrites cleanly.
 * Only enrolled students may be marked. Owner faculty or admin only.
 */
export const markSession = asyncHandler(async (req, res, next) => {
  const loaded = await loadSessionAndCourse(req.params.id, res, next);
  if (!loaded) return;
  const { session, course } = loaded;

  if (!canManageCourse(course, req.user)) {
    res.status(403);
    return next(new Error('Only the course faculty or an admin can mark attendance.'));
  }

  const entries = Array.isArray(req.body.records) ? req.body.records : [];
  if (entries.length === 0) {
    res.status(400);
    return next(new Error('No attendance marks provided.'));
  }

  const enrolledIds = new Set(course.studentIds.map((s) => String(s._id ?? s)));
  const ops = [];
  for (const entry of entries) {
    const studentId = String(entry.studentId ?? '');
    const status = entry.status;
    if (!mongoose.isValidObjectId(studentId) || !enrolledIds.has(studentId)) {
      res.status(400);
      return next(new Error('One or more marks reference a student not enrolled in this course.'));
    }
    if (!VALID_STATUSES.includes(status)) {
      res.status(400);
      return next(new Error(`Status must be one of: ${VALID_STATUSES.join(', ')}.`));
    }
    ops.push({
      updateOne: {
        filter: { sessionId: session._id, studentId },
        update: {
          $set: { status, markedBy: req.user.id, courseId: course._id, collegeId: course.collegeId },
        },
        upsert: true,
      },
    });
  }

  await AttendanceRecord.bulkWrite(ops);

  const records = await AttendanceRecord.find({ sessionId: session._id }).select('status');
  res.json({
    message: `Attendance saved for ${ops.length} student${ops.length === 1 ? '' : 's'}.`,
    counts: summarize(records),
    marked: records.length,
  });
});

/**
 * DELETE /api/attendance/sessions/:id
 * Delete a session and its records. Owner faculty or admin only.
 */
export const deleteSession = asyncHandler(async (req, res, next) => {
  const loaded = await loadSessionAndCourse(req.params.id, res, next);
  if (!loaded) return;
  const { session, course } = loaded;

  if (!canManageCourse(course, req.user)) {
    res.status(403);
    return next(new Error('Only the course faculty or an admin can delete this session.'));
  }

  await AttendanceRecord.deleteMany({ sessionId: session._id });
  await session.deleteOne();

  res.json({ message: 'Session deleted.' });
});
