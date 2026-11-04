const ApiError = require('./ApiError');

/**
 * Supabase returns { data, error } instead of throwing. Call this after every query.
 * The raw error is kept on `.cause` for logs but never sent to the client.
 */
function check(error, context) {
  if (!error) return;
  const err = new ApiError(500, 'DB_ERROR', 'Database error');
  err.cause = error;
  err.context = context;
  throw err;
}

module.exports = { check };
