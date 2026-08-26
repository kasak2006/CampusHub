import mongoose from 'mongoose';
import Course from '../models/Course.js';
import Resource from '../models/Resource.js';
import asyncHandler from '../utils/asyncHandler.js';
import { uploadFile } from '../utils/uploadImage.js';

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

/** Serialize a resource for the client (uploader may be populated). */
function toPublicResource(r) {
  const uploader = r.uploadedBy;
  const populated = uploader && uploader._id;
  return {
    id: r._id,
    courseId: r.courseId,
    title: r.title,
    fileUrl: r.fileUrl,
    linkUrl: r.linkUrl,
    type: r.type,
    createdAt: r.createdAt,
    uploadedBy: populated ? { id: uploader._id, name: uploader.name } : undefined,
  };
}

/* ─────────────────────────── resources (nested under course) ─────────────────────────── */

/**
 * GET /api/courses/:id/resources
 * List a course's materials (owner/admin or enrolled student), newest first.
 */
export const listResources = asyncHandler(async (req, res, next) => {
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

  const resources = await Resource.find({ courseId: course._id })
    .sort({ createdAt: -1 })
    .populate('uploadedBy', 'name');

  res.json({ resources: resources.map(toPublicResource), canManage: manage });
});

/**
 * POST /api/courses/:id/resources
 * Add a material (owner faculty/admin). Body: { title, file?, linkUrl?, type? } —
 * at least one of `file` (data URI) or `linkUrl` is required.
 */
export const createResource = asyncHandler(async (req, res, next) => {
  const course = await Course.findById(req.params.id);
  if (!course) {
    res.status(404);
    return next(new Error('Course not found.'));
  }
  if (!canManageCourse(course, req.user)) {
    res.status(403);
    return next(new Error('Only the course faculty or an admin can add materials.'));
  }

  const { title, file, linkUrl, type } = req.body;

  if (!title || !title.trim()) {
    res.status(400);
    return next(new Error('Resource title is required.'));
  }
  const link = (linkUrl ?? '').trim();
  if (!file && !link) {
    res.status(400);
    return next(new Error('Attach a file or provide a link.'));
  }

  let fileUrl = '';
  if (file) fileUrl = await uploadFile(file, 'resources');

  const resource = await Resource.create({
    courseId: course._id,
    title: title.trim(),
    fileUrl,
    linkUrl: fileUrl ? '' : link, // a file upload wins if both were sent
    type: (type ?? '').trim() || (fileUrl ? 'file' : 'link'),
    collegeId: course.collegeId,
    uploadedBy: req.user.id,
  });

  const populated = await resource.populate('uploadedBy', 'name');
  res.status(201).json({ resource: toPublicResource(populated) });
});

/* ─────────────────────────── resource delete ─────────────────────────── */

/**
 * DELETE /api/resources/:id
 * Remove a material (owner faculty/admin of the resource's course).
 */
export const deleteResource = asyncHandler(async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400);
    return next(new Error('Invalid resource id.'));
  }
  const resource = await Resource.findById(req.params.id);
  if (!resource) {
    res.status(404);
    return next(new Error('Resource not found.'));
  }
  const course = await Course.findById(resource.courseId);
  if (!course) {
    res.status(404);
    return next(new Error('Course not found.'));
  }
  if (!canManageCourse(course, req.user)) {
    res.status(403);
    return next(new Error('Only the course faculty or an admin can delete materials.'));
  }

  await resource.deleteOne();
  res.json({ message: 'Resource deleted.' });
});
