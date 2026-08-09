import api from './api.js';

/**
 * Clubs API (Phase 2). Thin wrappers over the axios instance so pages don't
 * repeat endpoint strings. All calls ride the httpOnly auth cookie.
 */
export const listClubs = () => api.get('/clubs').then((r) => r.data.clubs);

export const getClub = (id) => api.get(`/clubs/${id}`).then((r) => r.data.club);

export const createClub = (payload) =>
  api.post('/clubs', payload).then((r) => r.data.club);

export const updateClub = (id, payload) =>
  api.patch(`/clubs/${id}`, payload).then((r) => r.data.club);

export const deleteClub = (id) => api.delete(`/clubs/${id}`).then((r) => r.data);

export const requestToJoin = (id, message) =>
  api.post(`/clubs/${id}/join`, { message }).then((r) => r.data);

export const leaveClub = (id) => api.post(`/clubs/${id}/leave`).then((r) => r.data);

export const listJoinRequests = (id) =>
  api.get(`/clubs/${id}/requests`).then((r) => r.data.requests);

export const decideJoinRequest = (id, requestId, action) =>
  api.patch(`/clubs/${id}/requests/${requestId}`, { action }).then((r) => r.data);

export const addClubLead = (id, userId) =>
  api.post(`/clubs/${id}/leads`, { userId }).then((r) => r.data);
