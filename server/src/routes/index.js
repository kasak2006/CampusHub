import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import clubRoutes from './club.routes.js';
import eventRoutes from './event.routes.js';
import courseRoutes from './course.routes.js';
import attendanceRoutes from './attendance.routes.js';
import announcementRoutes from './announcement.routes.js';
import notificationRoutes from './notification.routes.js';

/**
 * Root API router. Feature routers get mounted here as phases land:
 *   Phase 1 → /auth, /users
 *   Phase 2 → /clubs
 *   Phase 3 → /events, /registrations
 *   Phase 4 → /courses, /attendance
 *   Phase 6 → /announcements, /notifications
 */
const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/clubs', clubRoutes);
router.use('/events', eventRoutes);
router.use('/courses', courseRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/announcements', announcementRoutes);
router.use('/notifications', notificationRoutes);

export default router;
