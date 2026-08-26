import mongoose from 'mongoose';
import Course from '../models/Course.js';
import Assignment from '../models/Assignment.js';
import Submission from '../models/Submission.js';
import asyncHandler from '../utils/asyncHandler.js';
import { uploadFile } from '../utils/uploadImage.js';
import { notifyUsers } from '../utils/notify.js';

/* ─────────────────────────── helpers ─────────────────────────── */

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

/** Serialize an assignment for the client. */
function toPublicAssignment(a) {
  return {
    id: a._id,
    courseId: a.courseId,
    title: a.title,
    description: a.description,
    dueAt: a.dueAt,
    points: a.points,
    attachmentUrl: a.attachmentUrl,
    linkUrl: a.linkUrl,
    createdAt: a.createdAt,
  };
}

/** Serialize a submission (student may be populated). */
function toPublicSubmission(s) {
  if (!s) return null;
  const student = s.studentId;
  const studentPopulated = student && student._id;
  return {
    id: s._id,
    assignmentId: s.assignmentId,
    text: s.text,
    fileUrl: s.fileUrl,
    late: s.late,
    status: s.status,
    grade: s.grade,
    feedback: s.feedback,
    submittedAt: s.submittedAt,
    gradedAt: s.gradedAt,
    student: studentPopulated
      ? {
          id: student._id,
          name: student.name,
          email: student.email,
          rollNumber: student.rollNumber,
          department: student.department,
          avatarUrl: student.avatarUrl,
        }
      : undefined,
  };
}

/**
 * Load an assignment and its course, enforcing that the viewer can access the
 * course (owner/admin or enrolled). Returns { assignment, course, manage } or
 * null after sending the appropriate error.
 */
async function loadAssignmentAndCourse(id, req, res, next) {
  if (!mongoose.isValidObjectId(id)) {
    res.status(400);
    next(new Error('Invalid assignment id.'));
    return null;
  }
  const assignment = await Assignment.findById(id);
  if (!assignment) {
    res.status(404);
    next(new Error('Assignment not found.'));
    return null;
  }
  const course = await Course.findById(assignment.courseId);
  if (!course) {
    res.status(404);
    next(new Error('Course not found.'));
    return null;
  }
  const manage = canManageCourse(course, req.user);
  const enrolled = isEnrolled(course, req.user.id);
  if (!manage && !enrolled) {
    res.status(403);
    next(new Error('You do not have access to this assignment.'));
    return null;
  }
  return { assignment, course, manage };
}

/* ─────────────────────────── assignments (nested under course) ─────────────────────────── */

/**
 * GET /api/courses/:id/assignments
 * List a course's assignments (owner/admin or enrolled student). Students see
 * their own submission summary per assignment; faculty see submission counts.
 */
export const listAssignments = asyncHandler(async (req, res, next) => {
  const course = await Course.findById(req.params.id);
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

  const assignments = await Assignment.find({ courseId: course._id }).sort({ dueAt: -1 });
  const assignmentIds = assignments.map((a) => a._id);

  const payload = assignments.map(toPublicAssignment);

  if (manage) {
    // Submission counts per assignment (submitted vs graded), one aggregation.
    const counts = await Submission.aggregate([
      { $match: { assignmentId: { $in: assignmentIds } } },
      {
        $group: {
          _id: '$assignmentId',
          submitted: { $sum: 1 },
          graded: { $sum: { $cond: [{ $eq: ['$status', 'graded'] }, 1, 0] } },
        },
      },
    ]);
    const by = new Map(counts.map((c) => [String(c._id), c]));
    const enrolledCount = course.studentIds.length;
    for (const dto of payload) {
      const c = by.get(String(dto.id)) ?? { submitted: 0, graded: 0 };
      dto.stats = { submitted: c.submitted, graded: c.graded, enrolled: enrolledCount };
    }
  } else {
    // The student's own submission per assignment.
    const mine = await Submission.find({
      assignmentId: { $in: assignmentIds },
      studentId: req.user.id,
    });
    const by = new Map(mine.map((s) => [String(s.assignmentId), s]));
    for (const dto of payload) {
      dto.mySubmission = toPublicSubmission(by.get(String(dto.id)));
    }
  }

  res.json({ assignments: payload });
});

/**
 * POST /api/courses/:id/assignments
 * Create an assignment (owner faculty/admin). Optional `attachment` data-URI.
 * Notifies enrolled students.
 */
export const createAssignment = asyncHandler(async (req, res, next) => {
  const course = await Course.findById(req.params.id);
  if (!course) {
    res.status(404);
    return next(new Error('Course not found.'));
  }
  if (!canManageCourse(course, req.user)) {
    res.status(403);
    return next(new Error('Only the course faculty or an admin can create assignments.'));
  }

  const { title, description, dueAt, points, attachment, linkUrl } = req.body;

  if (!title || !title.trim()) {
    res.status(400);
    return next(new Error('Assignment title is required.'));
  }
  if (!dueAt || Number.isNaN(Date.parse(dueAt))) {
    res.status(400);
    return next(new Error('A valid due date is required.'));
  }
  let pts = points === undefined ? 100 : Number(points);
  if (!Number.isFinite(pts) || pts < 0) {
    res.status(400);
    return next(new Error('Points must be a non-negative number.'));
  }

  let attachmentUrl = '';
  if (attachment) attachmentUrl = await uploadFile(attachment, 'assignments');

  const assignment = await Assignment.create({
    courseId: course._id,
    title: title.trim(),
    description: description?.trim() ?? '',
    dueAt: new Date(dueAt),
    points: pts,
    attachmentUrl,
    linkUrl: linkUrl?.trim() ?? '',
    collegeId: course.collegeId,
    createdBy: req.user.id,
  });

  // Notify enrolled students (excluding the author, handled in notifyUsers).
  await notifyUsers(course.studentIds, {
    type: 'assignment',
    refId: assignment._id,
    text: `New assignment in ${course.code}: ${assignment.title}`,
    link: `/assignments/${assignment._id}`,
    collegeId: course.collegeId,
  });

  res.status(201).json({ assignment: toPublicAssignment(assignment) });
});

/**
 * GET /api/courses/:id/gradebook
 * Per-student grades across all of a course's assignments (owner/admin only),
 * from a real aggregation pipeline. Mirrors the attendance analytics approach.
 */
export const getGradebook = asyncHandler(async (req, res, next) => {
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
    return next(new Error('Only the course faculty or an admin can view the gradebook.'));
  }

  const assignments = await Assignment.find({ courseId: course._id }).sort({ dueAt: 1 });
  const assignmentIds = assignments.map((a) => a._id);

  // All graded submissions for this course, keyed by student then assignment.
  const graded = await Submission.find({
    courseId: course._id,
    status: 'graded',
    assignmentId: { $in: assignmentIds },
  }).select('assignmentId studentId grade late');

  const byStudent = new Map();
  for (const s of graded) {
    const key = String(s.studentId);
    if (!byStudent.has(key)) byStudent.set(key, new Map());
    byStudent.get(key).set(String(s.assignmentId), { grade: s.grade, late: s.late });
  }

  const totalPoints = assignments.reduce((sum, a) => sum + (a.points || 0), 0);

  const rows = course.studentIds.map((student) => {
    const marks = byStudent.get(String(student._id)) ?? new Map();
    const grades = assignments.map((a) => {
      const m = marks.get(String(a._id));
      return { assignmentId: a._id, grade: m ? m.grade : null, late: m ? m.late : false };
    });
    const earned = grades.reduce((sum, g) => sum + (g.grade ?? 0), 0);
    const gradedCount = grades.filter((g) => g.grade !== null).length;
    return {
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        rollNumber: student.rollNumber,
      },
      grades,
      earned,
      gradedCount,
      // Average as a percent over the points of graded assignments only.
      averagePct: (() => {
        const gradedPoints = grades.reduce(
          (sum, g, i) => sum + (g.grade !== null ? assignments[i].points || 0 : 0),
          0
        );
        return gradedPoints ? Math.round((earned / gradedPoints) * 100) : null;
      })(),
    };
  });
  rows.sort((a, b) => a.student.name.localeCompare(b.student.name));

  res.json({
    course: { id: course._id, name: course.name, code: course.code },
    assignments: assignments.map((a) => ({
      id: a._id,
      title: a.title,
      points: a.points,
      dueAt: a.dueAt,
    })),
    totalPoints,
    rows,
  });
});

/* ─────────────────────────── assignment detail / edit ─────────────────────────── */

/**
 * GET /api/assignments/:id
 * Assignment detail (owner/admin or enrolled). A student gets their own
 * submission embedded.
 */
export const getAssignment = asyncHandler(async (req, res, next) => {
  const loaded = await loadAssignmentAndCourse(req.params.id, req, res, next);
  if (!loaded) return;
  const { assignment, course, manage } = loaded;

  const dto = toPublicAssignment(assignment);
  dto.course = { id: course._id, name: course.name, code: course.code };
  dto.canManage = manage;

  if (!manage) {
    const mine = await Submission.findOne({
      assignmentId: assignment._id,
      studentId: req.user.id,
    });
    dto.mySubmission = toPublicSubmission(mine);
  }

  res.json({ assignment: dto });
});

/**
 * PATCH /api/assignments/:id
 * Edit an assignment (owner/admin). Body may include title/description/dueAt/
 * points/attachment.
 */
export const updateAssignment = asyncHandler(async (req, res, next) => {
  const loaded = await loadAssignmentAndCourse(req.params.id, req, res, next);
  if (!loaded) return;
  const { assignment, manage } = loaded;
  if (!manage) {
    res.status(403);
    return next(new Error('Only the course faculty or an admin can edit this assignment.'));
  }

  const { title, description, dueAt, points, attachment, linkUrl } = req.body;

  if (title !== undefined) {
    if (!title.trim()) {
      res.status(400);
      return next(new Error('Assignment title cannot be empty.'));
    }
    assignment.title = title.trim();
  }
  if (description !== undefined) assignment.description = description.trim();
  if (dueAt !== undefined) {
    if (Number.isNaN(Date.parse(dueAt))) {
      res.status(400);
      return next(new Error('Invalid due date.'));
    }
    assignment.dueAt = new Date(dueAt);
  }
  if (points !== undefined) {
    const pts = Number(points);
    if (!Number.isFinite(pts) || pts < 0) {
      res.status(400);
      return next(new Error('Points must be a non-negative number.'));
    }
    assignment.points = pts;
  }
  // linkUrl is editable, including clearing it (send '').
  if (linkUrl !== undefined) assignment.linkUrl = linkUrl.trim();
  if (attachment) assignment.attachmentUrl = await uploadFile(attachment, 'assignments');

  await assignment.save();
  res.json({ assignment: toPublicAssignment(assignment) });
});

/**
 * DELETE /api/assignments/:id
 * Delete an assignment and cascade its submissions (owner/admin).
 */
export const deleteAssignment = asyncHandler(async (req, res, next) => {
  const loaded = await loadAssignmentAndCourse(req.params.id, req, res, next);
  if (!loaded) return;
  const { assignment, manage } = loaded;
  if (!manage) {
    res.status(403);
    return next(new Error('Only the course faculty or an admin can delete this assignment.'));
  }

  await Submission.deleteMany({ assignmentId: assignment._id });
  await assignment.deleteOne();

  res.json({ message: 'Assignment deleted.' });
});

/* ─────────────────────────── submissions ─────────────────────────── */

/**
 * GET /api/assignments/:id/submissions
 * The grading roster: every enrolled student with their submission (or null),
 * in name order. Owner faculty or admin only.
 */
export const listSubmissions = asyncHandler(async (req, res, next) => {
  const loaded = await loadAssignmentAndCourse(req.params.id, req, res, next);
  if (!loaded) return;
  const { assignment, manage } = loaded;
  if (!manage) {
    res.status(403);
    return next(new Error('Only the course faculty or an admin can view submissions.'));
  }

  const course = await Course.findById(assignment.courseId).populate(
    'studentIds',
    'name email rollNumber department avatarUrl'
  );
  const submissions = await Submission.find({ assignmentId: assignment._id });
  const by = new Map(submissions.map((s) => [String(s.studentId), s]));

  const roster = course.studentIds.map((student) => {
    const sub = by.get(String(student._id));
    return {
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        rollNumber: student.rollNumber,
        department: student.department,
        avatarUrl: student.avatarUrl,
      },
      submission: sub ? toPublicSubmission(sub) : null,
    };
  });
  roster.sort((a, b) => a.student.name.localeCompare(b.student.name));

  res.json({
    assignment: toPublicAssignment(assignment),
    roster,
  });
});

/**
 * POST /api/assignments/:id/submissions
 * Submit or re-submit (enrolled student). Body: { text, file } — at least one
 * required. Upserts the one-per-(assignment,student) doc; flags `late` if past
 * the due date. Blocked once the submission has been graded.
 */
export const submitAssignment = asyncHandler(async (req, res, next) => {
  const loaded = await loadAssignmentAndCourse(req.params.id, req, res, next);
  if (!loaded) return;
  const { assignment, course, manage } = loaded;

  if (manage) {
    res.status(403);
    return next(new Error('Faculty create and grade assignments; only students submit.'));
  }

  const { text, file } = req.body;
  const trimmedText = (text ?? '').trim();
  if (!trimmedText && !file) {
    res.status(400);
    return next(new Error('Provide submission text, a file, or both.'));
  }

  const existing = await Submission.findOne({
    assignmentId: assignment._id,
    studentId: req.user.id,
  });
  if (existing && existing.status === 'graded') {
    res.status(409);
    return next(new Error('This submission has already been graded and cannot be changed.'));
  }

  let fileUrl = existing?.fileUrl ?? '';
  if (file) fileUrl = await uploadFile(file, 'submissions');

  const now = new Date();
  const late = now.getTime() > new Date(assignment.dueAt).getTime();

  const fields = {
    courseId: course._id,
    text: trimmedText,
    fileUrl,
    late,
    status: 'submitted',
    submittedAt: now,
    collegeId: course.collegeId,
  };

  const submission = existing
    ? Object.assign(existing, fields)
    : new Submission({ assignmentId: assignment._id, studentId: req.user.id, ...fields });
  await submission.save();

  res.status(existing ? 200 : 201).json({ submission: toPublicSubmission(submission) });
});

/**
 * PATCH /api/submissions/:id/grade
 * Grade a submission with an optional feedback note (owner faculty/admin of the
 * assignment's course). Validates 0 ≤ grade ≤ points. Notifies the student.
 */
export const gradeSubmission = asyncHandler(async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400);
    return next(new Error('Invalid submission id.'));
  }
  const submission = await Submission.findById(req.params.id);
  if (!submission) {
    res.status(404);
    return next(new Error('Submission not found.'));
  }

  const assignment = await Assignment.findById(submission.assignmentId);
  const course = await Course.findById(submission.courseId);
  if (!assignment || !course) {
    res.status(404);
    return next(new Error('Assignment or course not found.'));
  }
  if (!canManageCourse(course, req.user)) {
    res.status(403);
    return next(new Error('Only the course faculty or an admin can grade submissions.'));
  }

  const grade = Number(req.body.grade);
  if (!Number.isFinite(grade) || grade < 0 || grade > assignment.points) {
    res.status(400);
    return next(new Error(`Grade must be a number between 0 and ${assignment.points}.`));
  }

  submission.grade = grade;
  submission.feedback = (req.body.feedback ?? '').trim();
  submission.status = 'graded';
  submission.gradedBy = req.user.id;
  submission.gradedAt = new Date();
  await submission.save();

  await notifyUsers([submission.studentId], {
    type: 'grade',
    refId: assignment._id,
    text: `Your submission for "${assignment.title}" was graded: ${grade}/${assignment.points}`,
    link: `/assignments/${assignment._id}`,
    collegeId: course.collegeId,
  });

  res.json({ submission: toPublicSubmission(submission) });
});
