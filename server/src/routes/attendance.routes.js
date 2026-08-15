import { Router } from 'express';
import {
  listSessions,
  createSession,
  getSession,
  markSession,
  deleteSession,
} from '../controllers/attendanceController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

/**
 * Attendance module routes (Phase 4), mounted at /api/attendance.
 *
 * All routes require authentication. Creating a session is restricted to faculty
 * and admins; per-session actions (view roster, mark, delete) are further
 * restricted to the owning course's faculty or an admin inside the controllers.
 * Listing sessions is readable by enrolled students (their own status only).
 */
const router = Router();

router.use(protect);

router.route('/sessions').get(listSessions).post(authorize('faculty', 'admin'), createSession);
router
  .route('/sessions/:id')
  .get(getSession)
  .patch(markSession)
  .delete(deleteSession);

export default router;
