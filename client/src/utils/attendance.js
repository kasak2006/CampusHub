/**
 * Shared attendance helpers (Phase 4). Kept out of the page components so React
 * Fast Refresh stays happy (a module that also exports non-components disables
 * it for that file).
 */

/** Attendance-% badge class: green at/above threshold, amber mid, red low. */
export function pctClass(pct) {
  if (pct >= 75) return 'b-good';
  if (pct >= 50) return 'b-warn';
  return 'b-crit';
}
