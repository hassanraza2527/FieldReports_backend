require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('URL       :', url);
console.log('Key starts:', key ? key.slice(0, 12) + '...' : 'MISSING');

const supabase = createClient(url, key, { auth: { persistSession: false } });

const show = (error) => `ERROR -> ${error.message || ''} ${error.code || ''} ${error.details || ''}`;

(async () => {
  for (const table of ['users', 'reports', 'report_images']) {
    const { error, count } = await supabase.from(table).select('id', { count: 'exact', head: true });
    console.log(table.padEnd(14), error ? show(error) : `ok (${count} rows)`);
  }
  const { data, error } = await supabase.storage.listBuckets();
  console.log('buckets       ', error ? show(error) : data.map((b) => b.name).join(', ') || 'none');
})();