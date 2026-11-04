const express = require('express');
const env = require('../config/env');
const reportController = require('../controllers/report.controller');
const imageController = require('../controllers/image.controller');
const chaos = require('../middleware/chaos');
const requireAuth = require('../middleware/auth');
const validate = require('../middleware/validate');
const schemas = require('../validators/report.validator');

const router = express.Router();

// Order matters: network misbehaviour first, then identity, then the real work.
router.use(chaos);
router.use(requireAuth);

router.get('/', validate(schemas.list), reportController.list);
router.put('/:reportId', validate(schemas.upsert), reportController.upsert);
router.get('/:reportId', validate(schemas.byReport), reportController.getOne);
router.post('/:reportId/commit', validate(schemas.byReport), reportController.commit);

// Raw JPEG bytes. The parser limit rejects oversize bodies (413) before they are buffered.
router.put(
  '/:reportId/images/:imageId',
  validate(schemas.byImage),
  express.raw({ type: () => true, limit: env.MAX_IMAGE_BYTES }),
  imageController.upload,
);

module.exports = router;
