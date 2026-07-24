import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const {
  DATABASE_URL,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  BOOTSTRAP_SENIOR_NAME = 'Admin',
  BOOTSTRAP_SENIOR_EMAIL,
  BOOTSTRAP_SENIOR_PASSWORD,
} = process.env;

async function main() {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL must be set (Supabase project Settings > Database > Connection string)');
  }

  const client = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('supabase') ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();

  const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  console.log('Applying schema...');
  await client.query(schemaSql);

  const { rows } = await client.query('SELECT COUNT(*)::int AS count FROM profiles');
  await client.end();

  if (rows[0].count > 0) {
    console.log('Profiles table already populated, skipping bootstrap user.');
    console.log('Database ready.');
    return;
  }

  if (!BOOTSTRAP_SENIOR_EMAIL || !BOOTSTRAP_SENIOR_PASSWORD) {
    console.log(
      'No profiles found. Set BOOTSTRAP_SENIOR_EMAIL and BOOTSTRAP_SENIOR_PASSWORD in .env to auto-create the first senior account.'
    );
    console.log('Database ready.');
    return;
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to create the bootstrap user.');
    process.exitCode = 1;
    return;
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = BOOTSTRAP_SENIOR_EMAIL.toLowerCase();
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: BOOTSTRAP_SENIOR_PASSWORD,
    email_confirm: true,
  });

  if (error) {
    console.error('Failed to create bootstrap Supabase Auth user:', error.message);
    process.exitCode = 1;
    return;
  }

  const insertClient = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('supabase') ? { rejectUnauthorized: false } : undefined,
  });
  await insertClient.connect();
  await insertClient.query(
    'INSERT INTO profiles (id, name, email, role) VALUES ($1, $2, $3, $4)',
    [data.user.id, BOOTSTRAP_SENIOR_NAME, email, 'senior']
  );
  await insertClient.end();

  console.log(`Bootstrap senior user created: ${email}`);
  console.log('Database ready.');
}

main().catch((err) => {
  console.error('Database initialization failed:', err);
  process.exitCode = 1;
});
