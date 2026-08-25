/**
 * Who may post announcements at all. The specific audiences a user can reach are
 * computed per-user on the Announcements page (their led clubs, taught courses,
 * and — for faculty/admin — the whole college); this is just the coarse gate for
 * showing the composer. Plain students can read but not post. Mirrors the
 * server's per-scope checks in announcementController.canPostTo.
 */
export function canPostAnnouncement(role) {
  return role === 'faculty' || role === 'admin' || role === 'club_lead';
}

/** Human label for an announcement's scope, used on feed cards. */
export function scopeLabel(scope) {
  if (scope === 'college') return 'College-wide';
  if (scope === 'club') return 'Club';
  if (scope === 'course') return 'Course';
  return scope;
}
