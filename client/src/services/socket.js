import { io } from 'socket.io-client';

/**
 * Shared Socket.io client. A single connection is reused across the app.
 * In dev, an empty URL means "same origin", which Vite proxies to the
 * Express server (see vite.config.js).
 *
 * Phase 3 wires this up for live event registration counts: a client joins an
 * event's room and receives `registrationUpdate` broadcasts (see
 * `subscribeToEvent`).
 */
const socket = io(import.meta.env.VITE_SOCKET_URL || '/', {
  withCredentials: true,
  autoConnect: true,
});

socket.on('connect', () => {
  console.log('[socket] connected:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('[socket] disconnected:', reason);
});

/**
 * Force a fresh handshake so the server re-reads the auth cookie (Phase 6). The
 * socket auto-connects at page load; if the user then logs in (or out) within
 * the same page session, reconnecting re-runs the handshake with the current
 * cookie so they join/leave their `user:${id}` notification room correctly.
 */
export function reconnectSocket() {
  socket.disconnect();
  socket.connect();
}

/**
 * Join an event's room and receive live count updates. Returns an unsubscribe
 * function that removes the listener and leaves the room. Re-joins on reconnect
 * so updates survive a dropped connection.
 *
 *   const off = subscribeToEvent(id, (counts) => setCounts(counts));
 *   // …later
 *   off();
 */
export function subscribeToEvent(eventId, onUpdate) {
  const id = String(eventId);
  const join = () => socket.emit('event:join', id);
  const handler = (payload) => {
    if (String(payload.eventId) === id) onUpdate(payload);
  };

  join();
  socket.on('registrationUpdate', handler);
  socket.on('connect', join); // re-join after a reconnect

  return () => {
    socket.off('registrationUpdate', handler);
    socket.off('connect', join);
    socket.emit('event:leave', id);
  };
}

/**
 * Listen for live notifications (Phase 6). The server auto-joins each connection
 * to its `user:${id}` room from the auth cookie, so the client just listens — no
 * join needed. Returns an unsubscribe function.
 *
 *   const off = subscribeToNotifications((n) => addNotification(n));
 *   // …later
 *   off();
 */
export function subscribeToNotifications(onNotification) {
  const handler = (notification) => onNotification(notification);
  socket.on('notification', handler);
  return () => socket.off('notification', handler);
}

export default socket;
