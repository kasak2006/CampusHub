import { Router } from 'express';
import {
  listNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
} from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';

/**
 * Notifications module routes (Phase 6), mounted at /api/notifications.
 *
 * All routes require authentication and act only on the current user's own
 * notifications. The specific `/unread-count` and `/read-all` paths are declared
 * before the `/:id/read` param route so they aren't captured as an id.
 */
const router = Router();

router.use(protect);

router.get('/', listNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllRead);
router.patch('/:id/read', markRead);

export default router;
