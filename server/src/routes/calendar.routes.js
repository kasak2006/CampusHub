import { Router } from 'express';
import { getCalendar } from '../controllers/calendarController.js';
import { protect } from '../middleware/authMiddleware.js';

/**
 * Calendar module route (Phase 8), mounted at /api/calendar. Read-only: it
 * aggregates data the Events, Attendance, and Assignments modules already own,
 * scoped to the authenticated user's own registrations and courses.
 */
const router = Router();

router.use(protect);

router.get('/', getCalendar);

export default router;
