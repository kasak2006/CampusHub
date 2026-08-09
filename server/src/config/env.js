import dotenv from 'dotenv';

dotenv.config();

/**
 * Centralized, validated access to environment variables.
 * Import from here instead of reading process.env all over the codebase.
 */
const env = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  clientOrigin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim()),
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  defaultCollegeId: process.env.DEFAULT_COLLEGE_ID || 'campushub-main',
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
};

export const isProd = env.nodeEnv === 'production';

/** Warn loudly (but don't crash the skeleton) if critical vars are missing. */
export function assertRequiredEnv() {
  const missing = [];
  if (!env.mongoUri) missing.push('MONGO_URI');
  if (!env.jwtSecret) missing.push('JWT_SECRET');
  if (missing.length) {
    console.warn(
      `[env] Missing recommended variables: ${missing.join(', ')}. ` +
        'Copy .env.example to .env and fill them in.'
    );
  }
}

export default env;
