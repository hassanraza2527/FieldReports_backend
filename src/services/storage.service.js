const supabase = require('../config/supabase');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const bucket = () => supabase.storage.from(env.SUPABASE_BUCKET);

function storageError(message, cause) {
  const err = new ApiError(502, 'STORAGE_ERROR', message);
  err.cause = cause;
  return err;
}

/** upsert:true => re-uploading the same image id overwrites the file. This is what makes retries safe. */
async function uploadImage(path, buffer) {
  const { error } = await bucket().upload(path, buffer, {
    contentType: 'image/jpeg',
    upsert: true,
    cacheControl: '3600',
  });
  if (error) throw storageError('Could not store image', error);
}

/** Returns Map<storagePath, signedUrl>. The bucket is private, so URLs are time-limited. */
async function signedUrls(paths) {
  const map = new Map();
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return map;

  const { data, error } = await bucket().createSignedUrls(unique, env.SIGNED_URL_TTL_SECONDS);
  if (error) throw storageError('Could not create image URLs', error);

  for (const item of data) {
    if (item.signedUrl) map.set(item.path, item.signedUrl);
  }
  return map;
}

async function remove(paths) {
  const unique = [...new Set(paths.filter(Boolean))];
  for (let i = 0; i < unique.length; i += 100) {
    const { error } = await bucket().remove(unique.slice(i, i + 100));
    if (error) throw storageError('Could not remove images', error);
  }
}

module.exports = { uploadImage, signedUrls, remove };
