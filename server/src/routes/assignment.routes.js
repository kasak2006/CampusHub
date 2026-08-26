import { Router } from 'express';
import {
  getAssignment,
  updateAssignment,
  deleteAssignment,
  listSubmissions,
  submitAssignment,
} from '../controllers/assignmentController.js';
import { protect } from '../middleware/authMiddleware.js';

/**
 * Assignments module routes (Phase 7), mounted at /api/assignments. Creation and
 * listing live under /api/courses/:id/assignments; these are the per-assignment
 * routes. All require authentication; access (owner/admin vs enrolled student) is
 * checked in-controller against the assignment's course, matching the courses and
 * attendance modules.
 */
const router = Router();

router.use(protect);

router.route('/:id').get(getAssignment).patch(updateAssignment).delete(deleteAssignment);
router.route('/:id/submissions').get(listSubmissions).post(submitAssignment);

export default router;
