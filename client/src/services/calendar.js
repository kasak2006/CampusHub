import api from './api.js';

/**
 * Calendar API (Phase 8). Fetches the merged, time-sorted feed of the user's
 * registered events, class sessions, and assignment due dates for a date range.
 * `from`/`to` are ISO strings; the server clamps and normalizes each item to
 * { type, title, when, refId, url, meta }.
 */
export const getCalendar = ({ from, to }) =>
  api.get('/calendar', { params: { from, to } }).then((r) => r.data.items);

export default getCalendar;
