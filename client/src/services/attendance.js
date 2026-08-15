import api from './api.js';

/**
 * Attendance sessions API (Phase 4). Sessions belong to a course; marking a
 * session upserts one record per student (present / late / absent).
 */
export const listSessions = (courseId) =>
  api.get('/attendance/sessions', { params: { courseId } }).then((r) => r.data.sessions);

export const createSession = (payload) =>
  api.post('/attendance/sessions', payload).then((r) => r.data.session);

export const getSession = (id) =>
  api.get(`/attendance/sessions/${id}`).then((r) => r.data);

export const markSession = (id, records) =>
  api.patch(`/attendance/sessions/${id}`, { records }).then((r) => r.data);

export const deleteSession = (id) =>
  api.delete(`/attendance/sessions/${id}`).then((r) => r.data);
