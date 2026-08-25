import { Router } from 'express';
import {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from '../controllers/announcementController.js';
import { protect } from '../middleware/authMiddleware.js';

/**
 * Announcements module routes (Phase 6), mounted at /api/announcements.
 *
 * All routes require authentication. Who may post/edit/delete is decided per
 * announcement inside the controller (by scope + club/course ownership + admin),
 * matching the pattern used by the events and courses modules.
 */
const router = Router();

router.use(protect);

router.route('/').get(listAnnouncements).post(createAnnouncement);
router.route('/:id').patch(updateAnnouncement).delete(deleteAnnouncement);

export default router;
