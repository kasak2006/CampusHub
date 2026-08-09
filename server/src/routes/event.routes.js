import { Router } from 'express';
import {
  listEvents,
  createEvent,
  getEvent,
  updateEvent,
  cancelEvent,
  registerForEvent,
  cancelRegistration,
  listEventRegistrations,
} from '../controllers/eventController.js';
import { protect } from '../middleware/authMiddleware.js';

/**
 * Events module routes (Phase 3), mounted at /api/events.
 *
 * All routes require authentication. Event management (create/edit/cancel and
 * the registration roster) is restricted per-event to a lead of the owning club
 * — enforced inside the controllers against Club.leadIds. Registration is open
 * to any logged-in user.
 */
const router = Router();

router.use(protect);

router.route('/').get(listEvents).post(createEvent);
router.route('/:id').get(getEvent).patch(updateEvent);
router.post('/:id/cancel', cancelEvent);

router.route('/:id/register').post(registerForEvent).delete(cancelRegistration);

router.get('/:id/registrations', listEventRegistrations);

export default router;
