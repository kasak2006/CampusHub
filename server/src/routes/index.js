import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import clubRoutes from './club.routes.js';
import eventRoutes from './event.routes.js';

/**
 * Root API router. Feature routers get mounted here as phases land:
 *   Phase 1 → /auth, /users
 *   Phase 2 → /clubs
 *   Phase 3 → /events, /registrations
 *   Phase 4 → /courses, /attendance
 */
const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/clubs', clubRoutes);
router.use('/events', eventRoutes);

export default router;
