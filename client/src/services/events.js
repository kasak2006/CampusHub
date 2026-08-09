import api from './api.js';

/**
 * Events API (Phase 3). Thin wrappers over the axios instance. All calls ride
 * the httpOnly auth cookie; live count updates arrive separately over the
 * socket (see services/socket.js → subscribeToEvent).
 */
export const listEvents = (clubId) =>
  api.get('/events', { params: clubId ? { clubId } : {} }).then((r) => r.data.events);

export const getEvent = (id) => api.get(`/events/${id}`).then((r) => r.data.event);

export const createEvent = (payload) =>
  api.post('/events', payload).then((r) => r.data.event);

export const updateEvent = (id, payload) =>
  api.patch(`/events/${id}`, payload).then((r) => r.data.event);

export const cancelEvent = (id) =>
  api.post(`/events/${id}/cancel`).then((r) => r.data);

export const registerForEvent = (id) =>
  api.post(`/events/${id}/register`).then((r) => r.data);

export const cancelRegistration = (id) =>
  api.delete(`/events/${id}/register`).then((r) => r.data);

export const listEventRegistrations = (id) =>
  api.get(`/events/${id}/registrations`).then((r) => r.data);
