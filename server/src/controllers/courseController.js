import mongoose from 'mongoose';
import Course from '../models/Course.js';
import AttendanceSession from '../models/AttendanceSession.js';
import AttendanceRecord from '../models/AttendanceRecord.js';
import User from '../models/User.js';
import asyncHandler from '../utils/asyncHandler.js';

/* ─────────────────────────── helpers ─────────────────────────── */

const oid = (id) => new mongoose.Types.ObjectId(String(id));

/** Default attendance threshold (%) below which a student is flagged. */
const DEFAULT_THRESHOLD = 75;

/** True if the user owns this course (its faculty) or is a college admin. */
function canManageCourse(course, user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return String(course.facultyId._id ?? course.facultyId) === String(user.id);
}

/** True if the user is enrolled in this course. */
function isEnrolled(course, userId) {
  return course.studentIds.some((s) => String(s._id ?? s) === String(userId));
}

/** Trim a populated User down to safe roster fields. */
function toPublicStudent(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    rollNumber: user.rollNumber,
    department: user.department,
    avatarUrl: user.avatarUrl,
  };
}

/** Serialize a course for the client. `students` included only when populated. */
function toPublicCourse(course, user) {
  const faculty = course.facultyId;
  const facultyPopulated = faculty && faculty._id;
  return {
    id: course._id,
    name: course.name,
    code: course.code,
    description: course.description,
    collegeId: course.collegeId,
    createdAt: course.createdAt,
    studentCount: course.studentIds.length,
    faculty: facultyPopulated
      ? { id: faculty._id, name: faculty.name, email: faculty.email }
      : { id: faculty },
    students: course.studentIds.some((s) => s._id)
      ? course.studentIds.map(toPublicStudent)
      : undefined,
    viewer: user
      ? {
          canManage: canManageCourse(course, user),
          isEnrolled: isEnrolled(course, user.id),
        }
      : undefined,
  };
}

/**
 * "Attended" means present OR late. This $cond is reused across the per-student
 * and per-session aggregations so the definition lives in one place.
 */
const ATTENDED_SUM = {
  $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0] },
};

/* ─────────────────────────── courses CRUD ─────────────────────────── */

/**
 * GET /api/courses
 * Role-aware listing:
 *   admin   → every course in the college
 *   faculty → the courses they own
 *   student → the courses they're enrolled in, each with their own attendance %
 */
export const listCourses = asyncHandler(async (req, res) => {
  const { role, id, collegeId } = req.user;

  let filter = { collegeId };
  if (role === 'faculty') filter.facultyId = id;
  else if (role !== 'admin') filter.studentIds = id;

  const courses = await Course.find(filter)
    .populate('facultyId', 'name email')
    .sort({ code: 1 });

  const payload = courses.map((c) => toPublicCourse(c, req.user));

  // For a student, annotate each course with their own attendance summary in
  // two batched aggregations (no per-course N+1).
  if (role !== 'faculty' && role !== 'admin' && courses.length) {
    const courseIds = courses.map((c) => c._id);
    const [sessionCounts, attended] = await Promise.all([
      AttendanceSession.aggregate([
        { $match: { courseId: { $in: courseIds } } },
        { $group: { _id: '$courseId', total: { $sum: 1 } } },
      ]),
      AttendanceRecord.aggregate([
        { $match: { courseId: { $in: courseIds }, studentId: oid(id) } },
        { $group: { _id: '$courseId', attended: ATTENDED_SUM } },
      ]),
    ]);
    const totalBy = new Map(sessionCounts.map((s) => [String(s._id), s.total]));
    const attendedBy = new Map(attended.map((a) => [String(a._id), a.attended]));
    for (const dto of payload) {
      const total = totalBy.get(String(dto.id)) ?? 0;
      const att = attendedBy.get(String(dto.id)) ?? 0;
      dto.myAttendance = {
        attended: att,
        total,
        pct: total ? Math.round((att / total) * 100) : 0,
      };
    }
  }

  res.json({ courses: payload });
});

/**
 * POST /api/courses
 * Create a course. Faculty (the owner) or admin only — enforced by `authorize`
 * in the router. The creating faculty becomes the course owner.
 */
export const createCourse = asyncHandler(async (req, res, next) => {
  const { name, code, description } = req.body;

  if (!name || !name.trim()) {
    res.status(400);
    return next(new Error('Course name is required.'));
  }
  if (!code || !code.trim()) {
    res.status(400);
    return next(new Error('Course code is required.'));
  }

  const normalizedCode = code.trim().toUpperCase();
  const exists = await Course.findOne({ collegeId: req.user.collegeId, code: normalizedCode });
  if (exists) {
    res.status(409);
    return next(new Error('A course with that code already exists.'));
  }

  const course = await Course.create({
    name: name.trim(),
    code: normalizedCode,
    description: description?.trim() ?? '',
    facultyId: req.user.id,
    collegeId: req.user.collegeId,
    createdBy: req.user.id,
  });

  const populated = await course.populate('facultyId', 'name email');
  res.status(201).json({ course: toPublicCourse(populated, req.user) });
});

/**
 * GET /api/courses/:id
 * Course detail. The owning faculty/admin get the full enrolled roster; an
 * enrolled student gets the course plus their own attendance summary. Anyone
 * else is forbidden.
 */
export const getCourse = asyncHandler(async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400);
    return next(new Error('Invalid course id.'));
  }
  const course = await Course.findById(req.params.id)
    .populate('facultyId', 'name email')
    .populate('studentIds', 'name email rollNumber department avatarUrl');
  if (!course) {
    res.status(404);
    return next(new Error('Course not found.'));
  }

  const manage = canManageCourse(course, req.user);
  const enrolled = isEnrolled(course, req.user.id);
  if (!manage && !enrolled) {
    res.status(403);
    return next(new Error('You do not have access to this course.'));
  }

  const dto = toPublicCourse(course, req.user);

  if (!manage) {
    // Students don't get the full roster, just their own standing.
    dto.students = undefined;
    dto.myAttendance = await attendanceSummary(course._id, req.user.id);
  }

  res.json({ course: dto });
});

/**
 * PATCH /api/courses/:id
 * Edit course name / code / description. Owner faculty or admin only.
 */
export const updateCourse = asyncHandler(async (req, res, next) => {
  const course = await Course.findById(req.params.id);
  if (!course) {
    res.status(404);
    return next(new Error('Course not found.'));
  }
  if (!canManageCourse(course, req.user)) {
    res.status(403);
    return next(new Error('Only the course faculty or an admin can edit this course.'));
  }

  const { name, code, description } = req.body;

  if (name !== undefined) {
    if (!name.trim()) {
      res.status(400);
      return next(new Error('Course name cannot be empty.'));
    }
    course.name = name.trim();
  }
  if (code !== undefined) {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) {
      res.status(400);
      return next(new Error('Course code cannot be empty.'));
    }
    const clash = await Course.findOne({
      collegeId: course.collegeId,
      code: normalizedCode,
      _id: { $ne: course._id },
    });
    if (clash) {
      res.status(409);
      return next(new Error('A course with that code already exists.'));
    }
    course.code = normalizedCode;
  }
  if (description !== undefined) course.description = description.trim();

  await course.save();
  const populated = await course.populate('facultyId', 'name email');
  res.json({ course: toPublicCourse(populated, req.user) });
});

/**
 * DELETE /api/courses/:id
 * Delete a course and cascade its sessions + records. Owner faculty or admin.
 */
export const deleteCourse = asyncHandler(async (req, res, next) => {
  const course = await Course.findById(req.params.id);
  if (!course) {
    res.status(404);
    return next(new Error('Course not found.'));
  }
  if (!canManageCourse(course, req.user)) {
    res.status(403);
    return next(new Error('Only the course faculty or an admin can delete this course.'));
  }

  await AttendanceRecord.deleteMany({ courseId: course._id });
  await AttendanceSession.deleteMany({ courseId: course._id });
  await course.deleteOne();

  res.json({ message: 'Course deleted.' });
});

/* ─────────────────────────── enrollment ─────────────────────────── */

/**
 * POST /api/courses/:id/students
 * Enroll students by email. Body: { emails: string[] } (also accepts a single
 * `email`). Emails are matched against users in the same college; unmatched
 * addresses are returned so the UI can report them. Owner faculty or admin.
 */
export const enrollStudents = asyncHandler(async (req, res, next) => {
  const course = await Course.findById(req.params.id);
  if (!course) {
    res.status(404);
    return next(new Error('Course not found.'));
  }
  if (!canManageCourse(course, req.user)) {
    res.status(403);
    return next(new Error('Only the course faculty or an admin can enroll students.'));
  }

  const raw = req.body.emails ?? (req.body.email ? [req.body.email] : []);
  const emails = [...new Set((Array.isArray(raw) ? raw : [raw]).map((e) => String(e).toLowerCase().trim()).filter(Boolean))];
  if (emails.length === 0) {
    res.status(400);
    return next(new Error('Provide at least one student email.'));
  }

  const users = await User.find({ collegeId: course.collegeId, email: { $in: emails } }).select(
    'name email rollNumber department avatarUrl'
  );
  const foundEmails = new Set(users.map((u) => u.email));
  const notFound = emails.filter((e) => !foundEmails.has(e));

  const enrolledIds = new Set(course.studentIds.map((s) => String(s)));
  let added = 0;
  for (const u of users) {
    if (!enrolledIds.has(String(u._id))) {
      course.studentIds.push(u._id);
      added += 1;
    }
  }
  if (added) await course.save();

  const populated = await course.populate('studentIds', 'name email rollNumber department avatarUrl');
  res.json({
    added,
    notFound,
    students: populated.studentIds.map(toPublicStudent),
  });
});

/**
 * DELETE /api/courses/:id/students/:studentId
 * Unenroll a student and drop their attendance records for this course (their
 * marks would otherwise linger off-roster and skew analytics). Owner or admin.
 */
export const unenrollStudent = asyncHandler(async (req, res, next) => {
  const course = await Course.findById(req.params.id);
  if (!course) {
    res.status(404);
    return next(new Error('Course not found.'));
  }
  if (!canManageCourse(course, req.user)) {
    res.status(403);
    return next(new Error('Only the course faculty or an admin can unenroll students.'));
  }

  const { studentId } = req.params;
  const before = course.studentIds.length;
  course.studentIds = course.studentIds.filter((s) => String(s) !== String(studentId));
  if (course.studentIds.length === before) {
    res.status(404);
    return next(new Error('That student is not enrolled in this course.'));
  }

  await course.save();
  await AttendanceRecord.deleteMany({ courseId: course._id, studentId });

  res.json({ message: 'Student unenrolled.' });
});

/* ─────────────────────────── analytics ─────────────────────────── */

/**
 * Compute one student's attendance summary for a course via aggregation.
 * total = number of sessions held; attended = present + late records.
 */
export async function attendanceSummary(courseId, studentId) {
  const [total, agg] = await Promise.all([
    AttendanceSession.countDocuments({ courseId }),
    AttendanceRecord.aggregate([
      { $match: { courseId: oid(courseId), studentId: oid(studentId) } },
      {
        $group: {
          _id: null,
          attended: ATTENDED_SUM,
          present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
          late: { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
        },
      },
    ]),
  ]);
  const s = agg[0] ?? { attended: 0, present: 0, late: 0, absent: 0 };
  return {
    total,
    attended: s.attended,
    present: s.present,
    late: s.late,
    absent: s.absent,
    pct: total ? Math.round((s.attended / total) * 100) : 0,
  };
}

/**
 * GET /api/courses/:id/analytics
 * Faculty analytics for a course, all from real aggregation pipelines:
 *   - perStudent: attendance % for every enrolled student
 *   - belowThreshold: those under the threshold (default 75%, `?threshold=`)
 *   - trend: per-session attendance % over time (for the Recharts line)
 * Owner faculty or admin only.
 */
export const courseAnalytics = asyncHandler(async (req, res, next) => {
  const course = await Course.findById(req.params.id).populate(
    'studentIds',
    'name email rollNumber department'
  );
  if (!course) {
    res.status(404);
    return next(new Error('Course not found.'));
  }
  if (!canManageCourse(course, req.user)) {
    res.status(403);
    return next(new Error('Only the course faculty or an admin can view analytics.'));
  }

  const threshold = Number.isFinite(Number(req.query.threshold))
    ? Math.min(100, Math.max(0, Number(req.query.threshold)))
    : DEFAULT_THRESHOLD;

  const sessions = await AttendanceSession.find({ courseId: course._id })
    .select('date dateKey title')
    .sort({ date: 1 });
  const totalSessions = sessions.length;
  const enrolledCount = course.studentIds.length;

  // Per-student attended counts (one pass over the records).
  const perStudentAgg = await AttendanceRecord.aggregate([
    { $match: { courseId: course._id } },
    {
      $group: {
        _id: '$studentId',
        attended: ATTENDED_SUM,
        present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
        late: { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } },
        absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
      },
    },
  ]);
  const byStudent = new Map(perStudentAgg.map((r) => [String(r._id), r]));

  const perStudent = course.studentIds.map((student) => {
    const r = byStudent.get(String(student._id)) ?? { attended: 0, present: 0, late: 0, absent: 0 };
    const pct = totalSessions ? Math.round((r.attended / totalSessions) * 100) : 0;
    return {
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        rollNumber: student.rollNumber,
        department: student.department,
      },
      attended: r.attended,
      present: r.present,
      late: r.late,
      absent: r.absent,
      total: totalSessions,
      pct,
      belowThreshold: pct < threshold,
    };
  });
  perStudent.sort((a, b) => a.pct - b.pct || a.student.name.localeCompare(b.student.name));
  const belowThreshold = perStudent.filter((p) => p.belowThreshold);

  // Per-session attendance % for the trend line.
  const perSessionAgg = await AttendanceRecord.aggregate([
    { $match: { courseId: course._id } },
    {
      $group: {
        _id: '$sessionId',
        attended: ATTENDED_SUM,
        present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
        late: { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } },
        absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
      },
    },
  ]);
  const bySession = new Map(perSessionAgg.map((r) => [String(r._id), r]));

  const trend = sessions.map((s) => {
    const r = bySession.get(String(s._id)) ?? { attended: 0, present: 0, late: 0, absent: 0 };
    return {
      sessionId: s._id,
      date: s.date,
      dateKey: s.dateKey,
      title: s.title,
      attended: r.attended,
      present: r.present,
      late: r.late,
      absent: r.absent,
      enrolled: enrolledCount,
      pct: enrolledCount ? Math.round((r.attended / enrolledCount) * 100) : 0,
    };
  });

  const averagePct = perStudent.length
    ? Math.round(perStudent.reduce((sum, p) => sum + p.pct, 0) / perStudent.length)
    : 0;

  res.json({
    threshold,
    totalSessions,
    enrolledCount,
    averagePct,
    perStudent,
    belowThreshold,
    trend,
  });
});
