import Notification from '../models/Notification.js';
import asyncHandler from '../utils/asyncHandler.js';
import { toPublicNotification } from '../utils/notify.js';

/**
 * GET /api/notifications
 * The current user's recent notifications (newest first) plus the unread count
 * for the bell badge. Requires `protect`.
 */
export const listNotifications = asyncHandler(async (req, res) => {
  const [notifications, unreadCount] = await Promise.all([
    Notification.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(50),
    Notification.countDocuments({ userId: req.user.id, read: false }),
  ]);

  res.json({
    notifications: notifications.map(toPublicNotification),
    unreadCount,
  });
});

/**
 * GET /api/notifications/unread-count
 * Just the unread count — cheap poll/refresh for the bell badge.
 */
export const getUnreadCount = asyncHandler(async (req, res) => {
  const unreadCount = await Notification.countDocuments({
    userId: req.user.id,
    read: false,
  });
  res.json({ unreadCount });
});

/**
 * PATCH /api/notifications/:id/read
 * Mark one of the user's own notifications read. Requires `protect`.
 */
export const markRead = asyncHandler(async (req, res, next) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { $set: { read: true } },
    { new: true }
  );
  if (!notification) {
    res.status(404);
    return next(new Error('Notification not found.'));
  }
  res.json({ notification: toPublicNotification(notification) });
});

/**
 * PATCH /api/notifications/read-all
 * Mark all of the user's notifications read (clears the bell badge).
 */
export const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { userId: req.user.id, read: false },
    { $set: { read: true } }
  );
  res.json({ message: 'All notifications marked read.', unreadCount: 0 });
});
