import { Router } from 'express';
import mongoose from 'mongoose';

const router = Router();

const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

/** GET /api/health — the Phase 0 "hello world" round-trip the client hits. */
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'CampusHub API is running 🎓',
    db: DB_STATES[mongoose.connection.readyState] ?? 'unknown',
    timestamp: new Date().toISOString(),
  });
});

export default router;
