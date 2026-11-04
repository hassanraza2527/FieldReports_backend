const env = require('../config/env');
const Report = require('../models/report.model');
const Image = require('../models/image.model');
const storage = require('../services/storage.service');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { isJpeg } = require('../utils/imageCheck');

/**
 * PUT /reports/:reportId/images/:imageId     (idempotent)
 * Body: the raw JPEG bytes (Content-Type: image/jpeg). Max MAX_IMAGE_BYTES.
 * Same image id twice => the file is overwritten, never duplicated.
 */
exports.upload = asyncHandler(async (req, res) => {
  const { reportId, imageId } = req.params;
  const userId = req.user.id;

  const report = await Report.getOwnedOrThrow(reportId, userId);

  const image = await Image.findInReport(imageId, reportId);
  if (!image) {
    throw ApiError.conflict('Image id is not part of this report', undefined, 'IMAGE_NOT_IN_REPORT');
  }

  const body = req.body;
  if (!Buffer.isBuffer(body) || body.length === 0) {
    throw ApiError.badRequest('Request body must contain the image bytes', undefined, 'EMPTY_BODY');
  }
  if (body.length > env.MAX_IMAGE_BYTES) {
    throw ApiError.payloadTooLarge(`Image is larger than ${env.MAX_IMAGE_BYTES} bytes`, 'IMAGE_TOO_LARGE');
  }
  if (!isJpeg(body)) {
    throw ApiError.unprocessable('Only JPEG images are accepted', undefined, 'NOT_JPEG');
  }

  // A committed report is immutable: acknowledge a retried upload without touching storage.
  if (report.status === 'committed' && image.storage_path) {
    return res.json({ id: image.id, sizeBytes: image.size_bytes, uploaded: true, alreadyStored: true });
  }

  const path = `${userId}/${reportId}/${imageId}.jpg`;
  await storage.uploadImage(path, body);
  const saved = await Image.markUploaded(imageId, { path, size: body.length });

  res.json({ id: saved.id, sizeBytes: saved.size_bytes, uploaded: true });
});
