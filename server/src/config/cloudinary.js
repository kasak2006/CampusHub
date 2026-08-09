import { v2 as cloudinary } from 'cloudinary';
import env from './env.js';

/**
 * Cloudinary is configured lazily. In Phase 0 the keys may be blank; upload
 * pipelines (avatar, club logo, event banner) get wired up in later phases.
 */
export function configureCloudinary() {
  const { cloudName, apiKey, apiSecret } = env.cloudinary;

  if (!cloudName || !apiKey || !apiSecret) {
    console.warn(
      '[cloudinary] Credentials not set — file uploads are disabled until ' +
        'CLOUDINARY_* vars are filled in .env.'
    );
    return null;
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  console.log('[cloudinary] Configured.');
  return cloudinary;
}

export { cloudinary };
export default cloudinary;
