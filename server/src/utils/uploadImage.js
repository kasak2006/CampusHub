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

/**
 * Upload an arbitrary file (PDF, doc, zip, image, …) to Cloudinary and return its
 * secure URL. Same contract as uploadImage but with `resource_type: 'auto'` so
 * non-image files are stored correctly — used for assignment attachments and
 * student submissions (Phase 7). Accepts a data URI or a remote URL; falls back
 * to passing a plain URL through when Cloudinary isn't configured.
 *
 * @param {string} source  data URI or file URL
 * @param {string} folder  Cloudinary folder, e.g. 'submissions'
 * @returns {Promise<string>} the hosted file URL
 */
export async function uploadFile(source, folder = 'campushub') {
  if (!source || typeof source !== 'string') {
    throw new Error('No file provided.');
  }

  const cloudinaryConfigured = Boolean(env.cloudinary.cloudName && env.cloudinary.apiSecret);

  if (!cloudinaryConfigured) {
    if (source.startsWith('data:')) {
      throw new Error(
        'File upload is disabled — Cloudinary is not configured. ' +
          'Provide a file URL instead, or set CLOUDINARY_* in server/.env.'
      );
    }
    return source;
  }

  const result = await cloudinary.uploader.upload(source, {
    folder: `${env.defaultCollegeId}/${folder}`,
    resource_type: 'auto',
  });
  return result.secure_url;
}

export default uploadImage;
