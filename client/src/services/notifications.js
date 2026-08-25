import api from './api.js';

/**
 * Notifications API (Phase 6). Powers the topbar bell. All calls act on the
 * current user's own notifications and ride the httpOnly auth cookie.
 */
export const listNotifications = () => api.get('/notifications').then((r) => r.data);

export const getUnreadCount = () =>
  api.get('/notifications/unread-count').then((r) => r.data.unreadCount);

export const markNotificationRead = (id) =>
  api.patch(`/notifications/${id}/read`).then((r) => r.data.notification);

export const markAllNotificationsRead = () =>
  api.patch('/notifications/read-all').then((r) => r.data);
