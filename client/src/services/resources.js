import api from './api.js';

/**
 * Course resources / materials API (Phase 8). Listing + upload are nested under a
 * course; delete is by resource id. All calls ride the httpOnly auth cookie.
 */
export const listResources = (courseId) =>
  api.get(`/courses/${courseId}/resources`).then((r) => r.data);

export const createResource = (courseId, payload) =>
  api.post(`/courses/${courseId}/resources`, payload).then((r) => r.data.resource);

export const deleteResource = (id) =>
  api.delete(`/resources/${id}`).then((r) => r.data);
