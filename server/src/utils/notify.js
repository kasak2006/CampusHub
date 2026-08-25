import Notification from '../models/Notification.js';
import { emitToUser } from '../socket/index.js';

/** Serialize a Notification document for the client (topbar bell + feed). */
export function toPublicNotification(n) {
  return {
    id: n._id,
    type: n.type,
    refId: n.refId,
    text: n.text,
    link: n.link,
    read: n.read,
    createdAt: n.createdAt,
  };
}

/**
 * Fan a notification out to many recipients (Phase 6): persist one document per
 * user, then push each live into that user's socket room so an open bell updates
 * without a refresh. Recipient ids are de-duplicated and stringified; pass an
 * already-filtered list (e.g. exclude the author).
 *
 * Returns the created documents. A no-op for an empty recipient list.
 */
export async function notifyUsers(recipientIds, { type, refId, text, link = '', collegeId }) {
  const ids = [...new Set((recipientIds || []).map((id) => String(id)))];
  if (!ids.length) return [];

  const created = await Notification.insertMany(
    ids.map((userId) => ({ userId, type, refId, text, link, collegeId }))
  );

  for (const n of created) emitToUser(n.userId, 'notification', toPublicNotification(n));

  return created;
}

export default notifyUsers;
