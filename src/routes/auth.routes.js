const router = require('express').Router();
const controller = require('../controllers/auth.controller');
const requireAuth = require('../middleware/auth');
const validate = require('../middleware/validate');
const schemas = require('../validators/auth.validator');

router.post('/register', validate(schemas.register), controller.register);
router.post('/login', validate(schemas.login), controller.login);
router.get('/me', requireAuth, controller.me);
router.post('/refresh', requireAuth, controller.refresh);

module.exports = router;
