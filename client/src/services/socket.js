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

export default socket;
