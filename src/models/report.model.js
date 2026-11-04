const supabase = require('../config/supabase');
const ApiError = require('../utils/ApiError');
const { check } = require('../utils/db');

const TABLE = 'reports';

async function findById(id) {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle();
  check(error, 'report.findById');
  return data;
}

/**
 * The report if it exists AND belongs to the user, otherwise 404.
 * (Same answer for "missing" and "someone else's" so ids cannot be probed.)
 */
async function getOwnedOrThrow(id, userId) {
  const report = await findById(id);
  if (!report || report.user_id !== userId) throw ApiError.notFound('Report not found', 'REPORT_NOT_FOUND');
  return report;
}

/** Race-safe create: a concurrent duplicate is silently ignored, caller re-reads with findById. */
async function insertIfAbsent({ id, userId, description }) {
  const { error } = await supabase
    .from(TABLE)
    .upsert(
      { id, user_id: userId, description, status: 'pending' },
      { onConflict: 'id', ignoreDuplicates: true },
    );
  check(error, 'report.insertIfAbsent');
}

/** Only touches PENDING reports, so a committed report can never be changed or reverted. */
async function updateDescriptionIfPending(id, description) {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ description })
    .eq('id', id)
    .eq('status', 'pending')
    .select()
    .maybeSingle();
  check(error, 'report.updateDescriptionIfPending');
  return data;
}

/** Returns the updated row, or null if it was not pending (already committed). */
async function markCommitted(id) {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ status: 'committed', committed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')
    .select()
    .maybeSingle();
  check(error, 'report.markCommitted');
  return data;
}

async function listCommitted(userId, { limit, before }) {
  let query = supabase
    .from(TABLE)
    .select(
      'id, description, status, created_at, committed_at, report_images ( id, position, size_bytes, storage_path )',
    )
    .eq('user_id', userId)
    .eq('status', 'committed')
    .order('committed_at', { ascending: false })
    .limit(limit);

  if (before) query = query.lt('committed_at', before);

  const { data, error } = await query;
  check(error, 'report.listCommitted');
  return data;
}

async function counts() {
  const count = async (status) => {
    const { count: n, error } = await supabase
      .from(TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('status', status);
    check(error, `report.count.${status}`);
    return n || 0;
  };
  return { pending: await count('pending'), committed: await count('committed') };
}

async function deleteAll() {
  const { error } = await supabase.from(TABLE).delete().neq('id', '00000000-0000-0000-0000-000000000000');
  check(error, 'report.deleteAll');
}

module.exports = {
  findById,
  getOwnedOrThrow,
  insertIfAbsent,
  updateDescriptionIfPending,
  markCommitted,
  listCommitted,
  counts,
  deleteAll,
};
