/** Operational error that maps cleanly to an HTTP response. */
class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message, details, code = 'BAD_REQUEST') {
    return new ApiError(400, code, message, details);
  }
  static unauthorized(message = 'Authentication required', code = 'UNAUTHORIZED') {
    return new ApiError(401, code, message);
  }
  static forbidden(message = 'Forbidden', code = 'FORBIDDEN') {
    return new ApiError(403, code, message);
  }
  static notFound(message = 'Not found', code = 'NOT_FOUND') {
    return new ApiError(404, code, message);
  }
  static conflict(message, details, code = 'CONFLICT') {
    return new ApiError(409, code, message, details);
  }
  static payloadTooLarge(message, code = 'PAYLOAD_TOO_LARGE') {
    return new ApiError(413, code, message);
  }
  static unprocessable(message, details, code = 'UNPROCESSABLE') {
    return new ApiError(422, code, message, details);
  }
}

module.exports = ApiError;
