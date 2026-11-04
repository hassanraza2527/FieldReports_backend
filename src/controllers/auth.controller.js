const env = require('../config/env');
const User = require('../models/user.model');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const password = require('../utils/password');
const token = require('../utils/token');

const publicUser = (user) => ({ id: user.id, email: user.email, name: user.name, createdAt: user.created_at });

const session = (user) => ({
  token: token.sign(user),
  tokenType: 'Bearer',
  expiresIn: env.JWT_EXPIRES_IN,
  user: publicUser(user),
});

exports.register = asyncHandler(async (req, res) => {
  const { email, password: plain, name } = req.body;
  const passwordHash = await password.hash(plain);
  const user = await User.create({ email, passwordHash, name });
  res.status(201).json(session(user));
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password: plain } = req.body;
  const user = await User.findByEmailWithHash(email);

  // Same message for "no such user" and "wrong password" so emails cannot be probed.
  const ok = user && (await password.compare(plain, user.password_hash));
  if (!ok) throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');

  res.json(session(user));
});

exports.me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw ApiError.unauthorized('Account no longer exists', 'USER_NOT_FOUND');
  res.json({ user: publicUser(user) });
});

/** Swap a still-valid token for a fresh one. An already-expired token must log in again. */
exports.refresh = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw ApiError.unauthorized('Account no longer exists', 'USER_NOT_FOUND');
  res.json(session(user));
});
