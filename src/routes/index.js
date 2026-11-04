const router = require('express').Router();

router.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

router.use('/api/auth', require('./auth.routes'));
router.use('/api/reports', require('./report.routes'));
router.use('/api/admin', require('./admin.routes'));

module.exports = router;
