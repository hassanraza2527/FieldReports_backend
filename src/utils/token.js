const jwt = require('jsonwebtoken');
const env = require('../config/env');

const ALGORITHM = 'HS256';

function sign(user) {
  return jwt.sign({ email: user.email }, env.JWT_SECRET, {
    subject: user.id,
    expiresIn: env.JWT_EXPIRES_IN,
    algorithm: ALGORITHM,
  });
}

function verify(token) {
  return jwt.verify(token, env.JWT_SECRET, { algorithms: [ALGORITHM] });
}

module.exports = { sign, verify };
