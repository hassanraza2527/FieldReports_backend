const ApiError = require('../utils/ApiError');

// eslint-disable-next-line no-unused-vars
module.exports = function errorHandler(err, req, res, _next) {
  if (res.headersSent) return req.socket.destroy();

  // body-parser errors
  if (err.type === 'entity.too.large') {
    err = ApiError.payloadTooLarge('Request body is too large', 'PAYLOAD_TOO_LARGE');
  } else if (err.type === 'entity.parse.failed') {
    err = ApiError.badRequest('Malformed JSON body', undefined, 'MALFORMED_JSON');
  }

  if (err instanceof ApiError) {
    if (err.status >= 500) console.error(`[${err.code}] ${err.message}`, err.context || '', err.cause || '');
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
  }

  console.error('Unhandled error:', err);
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
};
