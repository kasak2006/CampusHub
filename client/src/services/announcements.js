import api from './api.js';

/**
 * Announcements API (Phase 6). Thin wrappers over the axios instance so pages
 * don't repeat endpoint strings. All calls ride the httpOnly auth cookie.
 */
export const listAnnouncements = () =>
  api.get('/announcements').then((r) => r.data.announcements);

export const createAnnouncement = (payload) =>
  api.post('/announcements', payload).then((r) => r.data.announcement);

export const updateAnnouncement = (id, payload) =>
  api.patch(`/announcements/${id}`, payload).then((r) => r.data.announcement);

export const deleteAnnouncement = (id) =>
  api.delete(`/announcements/${id}`).then((r) => r.data);
