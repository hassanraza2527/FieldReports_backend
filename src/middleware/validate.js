const ApiError = require('../utils/ApiError');

/**
 * validate({ params, query, body }) with zod schemas.
 * Replaces req.params/query/body with the parsed (trimmed, coerced, defaulted) values.
 */
module.exports = (schemas) => (req, _res, next) => {
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
      return next(ApiError.badRequest('Validation failed', details, 'VALIDATION_ERROR'));
    }
    req[part] = result.data;
  }
  next();
};
