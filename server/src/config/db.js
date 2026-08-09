import mongoose from 'mongoose';
import env from './env.js';

/**
 * Connect to MongoDB. Returns the mongoose connection.
 * The server should await this before it starts listening so we fail fast
 * on a bad connection string.
 */
export async function connectDB() {
  if (!env.mongoUri) {
    throw new Error('MONGO_URI is not set — cannot connect to MongoDB.');
  }

  mongoose.set('strictQuery', true);

  const conn = await mongoose.connect(env.mongoUri);
  console.log(`[db] MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);

  mongoose.connection.on('error', (err) => {
    console.error('[db] MongoDB connection error:', err.message);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('[db] MongoDB disconnected.');
  });

  return conn;
}

export default connectDB;
