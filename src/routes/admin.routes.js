const express = require('express');
const controller = require('../controllers/admin.controller');
const requireAdmin = require('../middleware/adminAuth');

const router = express.Router();

router.use(requireAdmin);

router.get('/chaos', controller.getChaos);
router.post('/chaos', controller.setChaos);
router.get('/stats', controller.stats);
router.post('/reset', controller.resetData);

module.exports = router;
