'use strict';

const { v2: cloudinary } = require('cloudinary');
const env = require('./env');

// Configure the SDK once at load time. When credentials are missing the helpers
// below short-circuit, so callers fall back to local disk storage.
if (env.cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
    secure: true,
  });
}

/**
 * Upload a raw image buffer to Cloudinary.
 * @param {Buffer} buffer  file contents (from multer memory storage)
 * @param {object} [opts]
 * @returns {Promise<{ url: string, publicId: string }>}
 */
function uploadBuffer(buffer, opts = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: env.cloudinaryFolder,
        resource_type: 'image',
        // Optimise delivery: auto format + auto quality on the stored asset.
        fetch_format: 'auto',
        quality: 'auto',
        ...opts,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

/**
 * Delete an asset by its Cloudinary public_id.
 * @param {string} publicId
 * @returns {Promise<{ result: string }>}
 */
function deleteByPublicId(publicId) {
  return cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
}

/**
 * Best-effort extraction of a Cloudinary public_id from a delivery URL, e.g.
 *   https://res.cloudinary.com/<cloud>/image/upload/v1700/gomel-cars/abc123.jpg
 *   -> gomel-cars/abc123
 * Returns null when the URL is not a recognisable Cloudinary upload URL.
 * @param {string} url
 * @returns {string|null}
 */
function publicIdFromUrl(url) {
  if (typeof url !== 'string') return null;
  const m = url.match(/\/upload\/(?:[^/]+\/)*?(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?$/);
  if (!m || !m[1]) return null;
  return m[1];
}

module.exports = {
  cloudinary,
  uploadBuffer,
  deleteByPublicId,
  publicIdFromUrl,
};
