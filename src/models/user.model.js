const supabase = require('../config/supabase');
const ApiError = require('../utils/ApiError');
const { check } = require('../utils/db');

const TABLE = 'users';
const PUBLIC_COLUMNS = 'id, email, name, created_at';

async function create({ email, passwordHash, name }) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ email, password_hash: passwordHash, name })
    .select(PUBLIC_COLUMNS)
    .single();

  if (error && error.code === '23505') {
    throw ApiError.conflict('Email is already registered', undefined, 'EMAIL_TAKEN');
  }
  check(error, 'user.create');
  return data;
}

/** Includes password_hash. Only the auth controller should use this. */
async function findByEmailWithHash(email) {
  const { data, error } = await supabase.from(TABLE).select('*').eq('email', email).maybeSingle();
  check(error, 'user.findByEmailWithHash');
  return data;
}

async function findById(id) {
  const { data, error } = await supabase.from(TABLE).select(PUBLIC_COLUMNS).eq('id', id).maybeSingle();
  check(error, 'user.findById');
  return data;
}

module.exports = { create, findByEmailWithHash, findById };
