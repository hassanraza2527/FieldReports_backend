const chaos = require('../services/chaos.service');
const storage = require('../services/storage.service');
const Report = require('../models/report.model');
const Image = require('../models/image.model');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

exports.getChaos = (_req, res) => res.json(chaos.get());

exports.setChaos = (req, res, next) => {
  const parsed = chaos.patchSchema.safeParse(req.body || {});
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    return next(ApiError.badRequest('Invalid chaos settings', details, 'VALIDATION_ERROR'));
  }
  return res.json(chaos.apply(parsed.data));
};

/** Handy for checking "exactly once": reports/images counted here must match what the app sent. */
exports.stats = asyncHandler(async (_req, res) => {
  const [reports, imagesUploaded] = await Promise.all([Report.counts(), Image.countUploaded()]);
  res.json({ reports, imagesUploaded });
});

/** Wipes every report, image row and stored file. Users are kept. */
exports.resetData = asyncHandler(async (_req, res) => {
  const paths = await Image.listAllStoragePaths();
  await storage.remove(paths);
  await Image.deleteAll();
  await Report.deleteAll();
  res.json({ ok: true, removedFiles: paths.length });
});
