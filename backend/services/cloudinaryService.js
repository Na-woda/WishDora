const streamifier = require('streamifier');
const cloudinary = require('../config/cloudinary');

const isCloudinaryConfigured = () => {
  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = (process.env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = (process.env.CLOUDINARY_API_SECRET || '').trim();

  return Boolean(cloudName && cloudName !== 'your_cloud_name' && cloudName !== 'your_cloud_name_here' && cloudName !== 'Root' && apiKey && apiSecret);
};

const buildDataUrl = (buffer, mimeType = 'image/png') => `data:${mimeType};base64,${buffer.toString('base64')}`;

/**
 * Uploads a buffer (from multer memoryStorage) to Cloudinary via a stream.
 * Falls back to a data URL when Cloudinary is not configured or upload fails.
 */
const uploadBufferToCloudinary = async (buffer, folder = 'wishdora/cards', mimeType = 'image/png') => {
  if (!isCloudinaryConfigured()) {
    console.warn('[Cloudinary] Credentials are not configured. Saving image as a data URL fallback.');
    return {
      secure_url: buildDataUrl(buffer, mimeType),
      public_id: '',
    };
  }

  try {
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          transformation: [{ quality: 'auto:good', fetch_format: 'auto' }],
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      streamifier.createReadStream(buffer).pipe(uploadStream);
    });

    return result;
  } catch (error) {
    console.warn('[Cloudinary] Upload failed. Falling back to a data URL:', error.message);
    return {
      secure_url: buildDataUrl(buffer, mimeType),
      public_id: '',
    };
  }
};

const deleteFromCloudinary = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error(`[Cloudinary] Failed to delete ${publicId}:`, err.message);
  }
};

module.exports = { uploadBufferToCloudinary, deleteFromCloudinary };
