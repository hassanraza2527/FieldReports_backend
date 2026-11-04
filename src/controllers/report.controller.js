const Report = require('../models/report.model');
const Image = require('../models/image.model');
const storage = require('../services/storage.service');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { reportDto } = require('../utils/serializers');

/** Builds the response for one report; signs image URLs only once it is committed. */
async function describe(report) {
  const images = await Image.findByReport(report.id);
  const urls = report.status === 'committed' ? await storage.signedUrls(images.map((i) => i.storage_path)) : null;
  return reportDto(report, images, urls);
}

/**
 * PUT /reports/:reportId        (idempotent)
 * Step 1 of an upload: declares the report and the ids of its images.
 * Calling it again with the same ids is a no-op; a committed report is returned untouched.
 */
exports.upsert = asyncHandler(async (req, res) => {
  const { reportId } = req.params;
  const { description, imageIds } = req.body;
  const userId = req.user.id;

  let report = await Report.findById(reportId);

  if (report && report.user_id !== userId) {
    throw ApiError.conflict('Report id is already in use', undefined, 'REPORT_ID_TAKEN');
  }

  if (report && report.status === 'committed') {
    return res.status(200).json(await describe(report));
  }

  const existed = Boolean(report);

  if (existed) {
    report = (await Report.updateDescriptionIfPending(reportId, description)) || report;
  } else {
    await Report.insertIfAbsent({ id: reportId, userId, description });
    report = await Report.findById(reportId);
    if (!report || report.user_id !== userId) {
      throw ApiError.conflict('Report id is already in use', undefined, 'REPORT_ID_TAKEN');
    }
  }

  const stalePaths = await Image.syncForReport(reportId, imageIds);
  if (stalePaths.length) {
    // Best effort: an orphaned file is harmless, a failed cleanup must not fail the request.
    await storage.remove(stalePaths).catch((err) => console.error('stale image cleanup failed', err.cause || err));
  }

  res.status(existed ? 200 : 201).json(await describe(report));
});

/**
 * GET /reports/:reportId
 * Used by the app to resume: shows which images the server already holds.
 */
exports.getOne = asyncHandler(async (req, res) => {
  const report = await Report.getOwnedOrThrow(req.params.reportId, req.user.id);
  const dto = await describe(report);
  res.json({
    ...dto,
    receivedImageIds: dto.images.filter((i) => i.uploaded).map((i) => i.id),
  });
});

/**
 * POST /reports/:reportId/commit     (idempotent)
 * Final step. Only succeeds when every declared image has arrived.
 */
exports.commit = asyncHandler(async (req, res) => {
  const report = await Report.getOwnedOrThrow(req.params.reportId, req.user.id);

  if (report.status === 'committed') {
    return res.json(await describe(report));
  }

  const images = await Image.findByReport(report.id);
  const missing = images.filter((i) => !i.storage_path).map((i) => i.id);
  if (images.length === 0 || missing.length > 0) {
    throw ApiError.conflict('Some images have not been uploaded yet', { missing }, 'IMAGES_MISSING');
  }

  const committed = (await Report.markCommitted(report.id)) || (await Report.findById(report.id));
  res.json(await describe(committed));
});

/** GET /reports?limit=50&before=<committedAt>   -> committed reports of the signed-in user. */
exports.list = asyncHandler(async (req, res) => {
  const { limit, before } = req.query;
  const rows = await Report.listCommitted(req.user.id, { limit, before });

  const paths = rows.flatMap((row) => row.report_images.map((i) => i.storage_path));
  const urls = await storage.signedUrls(paths);

  const reports = rows.map(({ report_images: images, ...report }) => reportDto(report, images, urls));
  const last = reports[reports.length - 1];

  res.json({
    reports,
    nextBefore: reports.length === limit && last ? last.committedAt : null,
  });
});
