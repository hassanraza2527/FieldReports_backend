const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

// Service-role client: bypasses RLS, so ALL authorization is enforced in our controllers/models.
module.exports = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
