const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const { verify } = require('../utils/token');

/** Requires `Authorization: Bearer <jwt>`. Sets req.user = { id, email }. */
module.exports = function requireAuth(req, _res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(ApiError.unauthorized('Missing bearer token', 'TOKEN_MISSING'));
  }

  try {
    const payload = verify(token);
    req.user = { id: payload.sub, email: payload.email };
    return next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return next(ApiError.unauthorized('Token expired', 'TOKEN_EXPIRED'));
    }
    return next(ApiError.unauthorized('Invalid token', 'TOKEN_INVALID'));
  }
};
