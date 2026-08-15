import api from './api.js';

/**
 * Courses API (Phase 4). Thin wrappers over the axios instance; all calls ride
 * the httpOnly auth cookie. Listing/detail are role-aware server-side — students
 * get the courses they're enrolled in with their own attendance %.
 */
export const listCourses = () => api.get('/courses').then((r) => r.data.courses);

export const getCourse = (id) => api.get(`/courses/${id}`).then((r) => r.data.course);

export const createCourse = (payload) =>
  api.post('/courses', payload).then((r) => r.data.course);

export const updateCourse = (id, payload) =>
  api.patch(`/courses/${id}`, payload).then((r) => r.data.course);

export const deleteCourse = (id) => api.delete(`/courses/${id}`).then((r) => r.data);

export const enrollStudents = (id, emails) =>
  api.post(`/courses/${id}/students`, { emails }).then((r) => r.data);

export const unenrollStudent = (id, studentId) =>
  api.delete(`/courses/${id}/students/${studentId}`).then((r) => r.data);

export const getCourseAnalytics = (id, threshold) =>
  api
    .get(`/courses/${id}/analytics`, { params: threshold ? { threshold } : {} })
    .then((r) => r.data);
