import { Router } from 'express';
import { deleteResource } from '../controllers/resourceController.js';
import { protect } from '../middleware/authMiddleware.js';

/**
 * Resources module routes (Phase 8), mounted at /api/resources. Listing and
 * creation live under /api/courses/:id/resources; this is the per-resource delete.
 * Access (owner faculty/admin) is enforced in-controller against the resource's
 * course, matching the assignments module.
 */
const router = Router();

router.use(protect);

router.delete('/:id', deleteResource);

export default router;
