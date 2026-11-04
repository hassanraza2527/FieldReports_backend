require('dotenv').config();
const { z } = require('zod');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, 'looks too short to be a Supabase key'),
  SUPABASE_BUCKET: z.string().min(1).default('report-images'),

  JWT_SECRET: z.string().min(32, 'must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  ADMIN_KEY: z.string().min(8, 'must be at least 8 characters'),

  MAX_IMAGE_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
  SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(3600),

  CORS_ORIGIN: z.string().default('*'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
  console.error(
    `\nInvalid or missing environment variables:\n${lines.join('\n')}\n\n` +
      'Copy .env.example to .env and fill it in.\n',
  );
  process.exit(1);
}

module.exports = Object.freeze(parsed.data);
