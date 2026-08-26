import api from './api.js';

/**
 * Assignments + Submissions API (Phase 7). Thin wrappers over the axios instance
 * so pages don't repeat endpoint strings. All calls ride the httpOnly auth cookie.
 */

// Assignments (listing/creation are nested under a course).
export const listAssignments = (courseId) =>
  api.get(`/courses/${courseId}/assignments`).then((r) => r.data.assignments);

export const createAssignment = (courseId, payload) =>
  api.post(`/courses/${courseId}/assignments`, payload).then((r) => r.data.assignment);

export const getAssignment = (id) =>
  api.get(`/assignments/${id}`).then((r) => r.data.assignment);

export const updateAssignment = (id, payload) =>
  api.patch(`/assignments/${id}`, payload).then((r) => r.data.assignment);

export const deleteAssignment = (id) =>
  api.delete(`/assignments/${id}`).then((r) => r.data);

// Submissions.
export const listSubmissions = (assignmentId) =>
  api.get(`/assignments/${assignmentId}/submissions`).then((r) => r.data);

export const submitAssignment = (assignmentId, payload) =>
  api.post(`/assignments/${assignmentId}/submissions`, payload).then((r) => r.data.submission);

export const gradeSubmission = (submissionId, payload) =>
  api.patch(`/submissions/${submissionId}/grade`, payload).then((r) => r.data.submission);

// Gradebook (nested under a course).
export const getGradebook = (courseId) =>
  api.get(`/courses/${courseId}/gradebook`).then((r) => r.data);
