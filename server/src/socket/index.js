import { Server } from 'socket.io';
import env from '../config/env.js';

/**
 * Socket.io setup for the Phase 3 real-time core.
 *
 * Model: one room per event (`event:${eventId}`). Clients viewing an event join
 * its room; register/cancel actions emit `registrationUpdate` to that room so
 * every open event page updates its count live, no refresh needed.
 *
 * The io instance is stored module-side so controllers can emit via
 * `emitRegistrationUpdate()` without threading `io` through every call.
 */
let io = null;

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: env.clientOrigin,
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.id}`);

    // Client viewing an event joins its room to receive live count updates.
    socket.on('event:join', (eventId) => {
      if (typeof eventId === 'string' && eventId) socket.join(`event:${eventId}`);
    });
    socket.on('event:leave', (eventId) => {
      if (typeof eventId === 'string' && eventId) socket.leave(`event:${eventId}`);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[socket] disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
}

/** Accessor for the initialized io instance (null before initSocket runs). */
export function getIO() {
  return io;
}

/**
 * Broadcast a registration count change to everyone viewing an event.
 * No-op if sockets aren't initialized (e.g. in scripts/tests).
 */
export function emitRegistrationUpdate(eventId, payload) {
  if (!io) return;
  io.to(`event:${eventId}`).emit('registrationUpdate', { eventId: String(eventId), ...payload });
}

export default initSocket;
