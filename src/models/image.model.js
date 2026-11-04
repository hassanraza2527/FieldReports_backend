const supabase = require('../config/supabase');
const ApiError = require('../utils/ApiError');
const { check } = require('../utils/db');

const TABLE = 'report_images';

async function findByIds(ids) {
  const { data, error } = await supabase.from(TABLE).select('*').in('id', ids);
  check(error, 'image.findByIds');
  return data;
}

async function findByReport(reportId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('report_id', reportId)
    .order('position', { ascending: true });
  check(error, 'image.findByReport');
  return data;
}

async function findInReport(imageId, reportId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', imageId)
    .eq('report_id', reportId)
    .maybeSingle();
  check(error, 'image.findInReport');
  return data;
}

/**
 * Makes the report's image rows match `imageIds` exactly. Safe to call repeatedly.
 * Returns the storage paths of rows that were removed so the caller can delete the files.
 */
async function syncForReport(reportId, imageIds) {
  const existing = await findByIds(imageIds);

  const foreign = existing.filter((row) => row.report_id !== reportId);
  if (foreign.length) {
    throw ApiError.conflict(
      'One or more image ids already belong to another report',
      { imageIds: foreign.map((row) => row.id) },
      'IMAGE_ID_TAKEN',
    );
  }

  const have = new Set(existing.map((row) => row.id));
  const toInsert = imageIds
    .map((id, position) => ({ id, report_id: reportId, position }))
    .filter((row) => !have.has(row.id));

  if (toInsert.length) {
    const { error } = await supabase
      .from(TABLE)
      .upsert(toInsert, { onConflict: 'id', ignoreDuplicates: true });
    check(error, 'image.syncForReport.insert');
  }

  const keep = new Set(imageIds);
  const stale = (await findByReport(reportId)).filter((row) => !keep.has(row.id));
  if (stale.length) {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .in(
        'id',
        stale.map((row) => row.id),
      );
    check(error, 'image.syncForReport.delete');
  }
  return stale.map((row) => row.storage_path).filter(Boolean);
}

async function markUploaded(id, { path, size }) {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ storage_path: path, size_bytes: size, uploaded_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  check(error, 'image.markUploaded');
  return data;
}

async function listAllStoragePaths() {
  const { data, error } = await supabase.from(TABLE).select('storage_path').not('storage_path', 'is', null);
  check(error, 'image.listAllStoragePaths');
  return data.map((row) => row.storage_path);
}

async function countUploaded() {
  const { count, error } = await supabase
    .from(TABLE)
    .select('id', { count: 'exact', head: true })
    .not('storage_path', 'is', null);
  check(error, 'image.countUploaded');
  return count || 0;
}

async function deleteAll() {
  const { error } = await supabase.from(TABLE).delete().neq('id', '00000000-0000-0000-0000-000000000000');
  check(error, 'image.deleteAll');
}

module.exports = {
  findByReport,
  findInReport,
  syncForReport,
  markUploaded,
  listAllStoragePaths,
  countUploaded,
  deleteAll,
};
