/**
 * Shared helpers for the Phase 7 assignments/grades UI.
 */

/** Read a File into a data URI string (matches the upload pattern in EventForm). */
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** True if a due date is in the past. */
export function isOverdue(dueAt) {
  return new Date(dueAt).getTime() < Date.now();
}

/** Human due-date label, e.g. "Due Sep 3, 2026, 11:59 PM". */
export function dueLabel(dueAt) {
  return `Due ${new Date(dueAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })}`;
}

/**
 * The chip class + label describing a submission's state, from the student's
 * point of view. `null` submission → "Not submitted".
 */
export function submissionChip(submission) {
  if (!submission) return { cls: 'b-crit', label: 'Not submitted' };
  if (submission.status === 'graded') {
    return { cls: 'b-good', label: 'Graded' };
  }
  if (submission.late) return { cls: 'b-warn', label: 'Submitted late' };
  return { cls: 'b-good', label: 'Submitted' };
}
