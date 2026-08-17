/**
 * Who may create (and thereby lead) a club. Clubs are student-run, so creation
 * is limited to students and existing club leads — faculty and admin manage
 * clubs rather than found them. Mirrors the server's authorize('student',
 * 'club_lead') guard on POST /api/clubs.
 */
export function canCreateClub(role) {
  return role === 'student' || role === 'club_lead';
}
