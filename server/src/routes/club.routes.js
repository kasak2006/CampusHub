import { Router } from 'express';
import {
  listClubs,
  createClub,
  getClub,
  updateClub,
  deleteClub,
  requestToJoin,
  leaveClub,
  listJoinRequests,
  decideJoinRequest,
  addClubLead,
} from '../controllers/clubController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

/**
 * Clubs module routes (Phase 2), mounted at /api/clubs.
 *
 * Every route requires authentication. Per-club permissions (lead/admin) are
 * enforced inside the controllers against Club.leadIds, so a lead only manages
 * their own club(s). Club creation is self-service for students and existing
 * club leads — clubs are student-run, so faculty/admin manage rather than found
 * them. The creator becomes the club's first lead.
 */
const router = Router();

router.use(protect);

router.route('/').get(listClubs).post(authorize('student', 'club_lead'), createClub);

router.route('/:id').get(getClub).patch(updateClub).delete(deleteClub);

router.post('/:id/join', requestToJoin);
router.post('/:id/leave', leaveClub);

router.get('/:id/requests', listJoinRequests);
router.patch('/:id/requests/:requestId', decideJoinRequest);

router.post('/:id/leads', addClubLead);

export default router;
