import { Router } from 'express';
import { gradeSubmission } from '../controllers/assignmentController.js';
import { protect } from '../middleware/authMiddleware.js';

/**
 * Submissions module routes (Phase 7), mounted at /api/submissions. Students
 * create submissions under /api/assignments/:id/submissions; grading a specific
 * submission lives here. Restricted in-controller to the owning course faculty
 * or an admin.
 */
const router = Router();

router.use(protect);

router.patch('/:id/grade', gradeSubmission);

export default router;
