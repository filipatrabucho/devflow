import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function pgClientFor(databaseUrl) {
  return new pg.Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('supabase') ? { rejectUnauthorized: false } : undefined,
  });
}

// Applies schema.sql (idempotent — safe to re-run) and, only the first time
// (profiles table still empty), creates a bootstrap Supabase Auth user plus
// its `profiles` row with the `senior` role. Shared by the local `db:init`
// CLI below and by scripts/provision-client.mjs, which calls this directly
// against a freshly-created client project instead of the local .env one.
export async function applySchemaAndBootstrap({
  databaseUrl,
  supabaseUrl,
  serviceRoleKey,
  bootstrapName = 'Admin',
  bootstrapEmail,
  bootstrapPassword,
  log = console.log,
}) {
  if (!databaseUrl) {
    throw new Error('databaseUrl is required (Supabase project Settings > Database > Connection string)');
  }

  const client = pgClientFor(databaseUrl);
  await client.connect();

  const { rows: colCheck } = await client.query(
    `SELECT COUNT(*)::int AS count FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'roles' AND column_name = 'is_staff'`
  );
  const hadIsStaffColumn = colCheck[0].count > 0;

  const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  log('Applying schema...');
  await client.query(schemaSql);

  if (!hadIsStaffColumn) {
    await client.query("UPDATE roles SET is_staff = TRUE WHERE key_name = 'developer'");
    log('Defaulted "Counts as staff" to on for the developer role.');
  }

  const { rows } = await client.query('SELECT COUNT(*)::int AS count FROM profiles');
  await client.end();

  if (rows[0].count > 0) {
    log('Profiles table already populated, skipping bootstrap user.');
    return { bootstrapUserCreated: false };
  }

  if (!bootstrapEmail || !bootstrapPassword) {
    log('No profiles found and no bootstrap email/password given — skipping bootstrap user.');
    return { bootstrapUserCreated: false };
  }

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('supabaseUrl and serviceRoleKey are required to create the bootstrap user.');
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = bootstrapEmail.toLowerCase();
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: bootstrapPassword,
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Failed to create bootstrap Supabase Auth user: ${error.message}`);
  }

  const insertClient = pgClientFor(databaseUrl);
  await insertClient.connect();
  await insertClient.query(
    'INSERT INTO profiles (id, name, email, role) VALUES ($1, $2, $3, $4)',
    [data.user.id, bootstrapName, email, 'senior']
  );
  await insertClient.end();

  log(`Bootstrap senior user created: ${email}`);
  return { bootstrapUserCreated: true, userId: data.user.id, email };
}

// CLI entry point (`npm run db:init`), reading connection info from the
// local server/.env — the single-client, run-it-yourself workflow described
// in DEPLOYMENT.md.
async function runCli() {
  const {
    DATABASE_URL,
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    BOOTSTRAP_SENIOR_NAME,
    BOOTSTRAP_SENIOR_EMAIL,
    BOOTSTRAP_SENIOR_PASSWORD,
  } = process.env;

  await applySchemaAndBootstrap({
    databaseUrl: DATABASE_URL,
    supabaseUrl: SUPABASE_URL,
    serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
    bootstrapName: BOOTSTRAP_SENIOR_NAME,
    bootstrapEmail: BOOTSTRAP_SENIOR_EMAIL,
    bootstrapPassword: BOOTSTRAP_SENIOR_PASSWORD,
  });
  console.log('Database ready.');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  runCli().catch((err) => {
    console.error('Database initialization failed:', err.message);
    process.exitCode = 1;
  });
}
