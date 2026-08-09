import { cloudinary } from '../config/cloudinary.js';
import env from '../config/env.js';

/**
 * Upload an image to Cloudinary and return its secure URL.
 *
 * `source` may be a data URI (data:image/png;base64,…) sent from the browser, or
 * a remote image URL — Cloudinary accepts both directly, so no multer/file
 * middleware is needed. If Cloudinary isn't configured (keys blank in .env), we
 * gracefully fall back to passing an http(s) URL through unchanged, and reject
 * base64 uploads with a clear message.
 *
 * @param {string} source  data URI or image URL
 * @param {string} folder  Cloudinary folder, e.g. 'campushub/clubs'
 * @returns {Promise<string>} the hosted image URL
 */
export async function uploadImage(source, folder = 'campushub') {
  if (!source || typeof source !== 'string') {
    throw new Error('No image provided.');
  }

  const cloudinaryConfigured = Boolean(env.cloudinary.cloudName && env.cloudinary.apiSecret);

  if (!cloudinaryConfigured) {
    // No Cloudinary — accept a plain URL as-is, but we can't host raw base64.
    if (source.startsWith('data:')) {
      throw new Error(
        'Image upload is disabled — Cloudinary is not configured. ' +
          'Provide an image URL instead, or set CLOUDINARY_* in server/.env.'
      );
    }
    return source;
  }

  const result = await cloudinary.uploader.upload(source, {
    folder: `${env.defaultCollegeId}/${folder}`,
    resource_type: 'image',
  });
  return result.secure_url;
}

export default uploadImage;
