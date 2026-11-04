const crypto = require('crypto');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

/** Admin routes use a shared secret header (x-admin-key), not a user JWT. */
module.exports = function requireAdmin(req, _res, next) {
  const provided = Buffer.from(req.get('x-admin-key') || '');
  const expected = Buffer.from(env.ADMIN_KEY);

  const ok = provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
  if (!ok) return next(ApiError.unauthorized('Invalid admin key', 'ADMIN_KEY_INVALID'));
  next();
};
