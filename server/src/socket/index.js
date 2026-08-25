import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';

/**
 * Socket.io setup for the real-time core.
 *
 * Two room models coexist:
 *   - Phase 3: one room per event (`event:${eventId}`). Clients viewing an event
 *     join its room; register/cancel actions emit `registrationUpdate` there so
 *     every open event page updates its count live, no refresh needed.
 *   - Phase 6: one room per user (`user:${userId}`). On connect we read the auth
 *     cookie from the handshake and auto-join the user's personal room, so a
 *     fanned-out notification reaches every tab that user has open.
 *
 * The io instance is stored module-side so controllers can emit via
 * `emitRegistrationUpdate()` / `emitToUser()` without threading `io` through
 * every call.
 */
let io = null;

/** Pull one cookie's value out of a raw `Cookie:` header (no extra deps). */
function readCookie(header, name) {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: env.clientOrigin,
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.id}`);

    // Identify the user from the auth cookie (sent because the client connects
    // with credentials) and join their personal room for live notifications.
    const token = readCookie(socket.handshake.headers.cookie, 'token');
    if (token) {
      try {
        const { id } = jwt.verify(token, env.jwtSecret);
        if (id) {
          socket.data.userId = String(id);
          socket.join(`user:${id}`);
        }
      } catch {
        // Unauthenticated socket — event rooms still work; no personal room.
      }
    }

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

/**
 * Emit an event into a single user's personal room (all their open tabs).
 * No-op if sockets aren't initialized (e.g. in scripts/tests).
 */
export function emitToUser(userId, event, payload) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
}

export default initSocket;
