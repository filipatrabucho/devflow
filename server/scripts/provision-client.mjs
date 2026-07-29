// One-shot provisioning for a new white-label DevFlow client: creates an
// isolated Supabase project, its storage buckets, applies schema.sql,
// creates the bootstrap Admin/Senior account, then creates a Netlify site
// pointed at this repo and configures its env vars (server + VITE_* branding)
// and kicks off the first build. See ../../PROVISIONING.md for the full
// prerequisites and flag reference; run with --dry-run first to see the
// planned steps without touching any real Supabase/Netlify account.
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import { applySchemaAndBootstrap } from '../sql/init.js';
import * as supa from './supabase-management.mjs';
import * as netlify from './netlify-api.mjs';

const REDACTED_KEY_PATTERN = /KEY|PASSWORD|DATABASE_URL/;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function generatePassword(length = 24) {
  return crypto.randomBytes(length).toString('base64url').slice(0, length);
}

function requireArg(args, key, message) {
  if (!args[key]) throw new Error(message || `--${key} is required`);
  return args[key];
}

function collectBranding(args) {
  const branding = {
    VITE_APP_NAME: args['app-name'],
    VITE_APP_TAGLINE: args.tagline,
    VITE_PRIMARY_COLOR: args['primary-color'],
    VITE_PRIMARY_HOVER_COLOR: args['primary-hover-color'],
    VITE_PRIMARY_LIGHT_COLOR: args['primary-light-color'],
    VITE_LOGO_URL: args['logo-url'],
    VITE_FAVICON_URL: args['favicon-url'],
  };
  for (const key of Object.keys(branding)) {
    if (branding[key] === undefined) delete branding[key];
  }
  return branding;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = Boolean(args['dry-run']);

  const clientName = requireArg(args, 'client-name');
  const projectSlug = args['project-slug'] || slugify(clientName);
  const region = args.region || 'eu-west-1';
  const branch = args.branch || 'main';
  const bootstrapName = args['bootstrap-name'] || 'Admin';
  const bootstrapEmail = requireArg(args, 'bootstrap-email');
  const bootstrapPassword = args['bootstrap-password'] || generatePassword();
  const dbPassword = args['db-password'] || generatePassword();
  const githubRepo = requireArg(args, 'github-repo', '--github-repo (e.g. "your-org/devflow") is required');
  const netlifyAccountSlug = args['netlify-account-slug'];
  const supabaseOrgId = args['supabase-org-id'] || process.env.SUPABASE_ORG_ID;
  const branding = collectBranding(args);

  console.log(`\n=== Provisioning DevFlow for "${clientName}" (${projectSlug}) ${dryRun ? '[DRY RUN]' : ''} ===\n`);

  const supabaseAccessToken = process.env.SUPABASE_ACCESS_TOKEN;
  const netlifyAuthToken = process.env.NETLIFY_AUTH_TOKEN;
  if (!dryRun) {
    if (!supabaseOrgId) throw new Error('--supabase-org-id (or SUPABASE_ORG_ID env var) is required');
    if (!supabaseAccessToken) throw new Error('SUPABASE_ACCESS_TOKEN env var is required');
    if (!netlifyAuthToken) throw new Error('NETLIFY_AUTH_TOKEN env var is required');
  }

  // 1. Supabase project
  let ref, supabaseUrl, anonKey, serviceRoleKey, databaseUrl;
  if (dryRun) {
    ref = `${projectSlug}-dryrun`;
    supabaseUrl = supa.projectUrl(ref);
    anonKey = '<anon-key-placeholder>';
    serviceRoleKey = '<service-role-key-placeholder>';
    databaseUrl = supa.buildDatabaseUrl(ref, dbPassword);
    console.log(`[dry-run] Would create Supabase project "${projectSlug}" in org ${supabaseOrgId || '<org>'}, region ${region}`);
    console.log(`[dry-run] Would wait for it to become active, then fetch its anon/service_role API keys`);
  } else {
    console.log('Creating Supabase project...');
    const project = await supa.createProject(supabaseAccessToken, {
      organizationId: supabaseOrgId,
      name: projectSlug,
      region,
      dbPassword,
    });
    ref = project.id;
    console.log(`Project created: ${ref}. Waiting for it to become active (this can take a few minutes)...`);
    await supa.waitUntilActive(supabaseAccessToken, ref, { log: console.log });
    supabaseUrl = supa.projectUrl(ref);
    ({ anonKey, serviceRoleKey } = await supa.getApiKeys(supabaseAccessToken, ref));
    databaseUrl = supa.buildDatabaseUrl(ref, dbPassword);
  }

  // 2. Storage buckets (avatars, branding)
  if (dryRun) {
    console.log('[dry-run] Would create Storage buckets: avatars, branding (both public)');
  } else {
    console.log('Creating storage buckets...');
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    for (const bucket of ['avatars', 'branding']) {
      const { error } = await supabaseAdmin.storage.createBucket(bucket, { public: true });
      if (error && !/already exists/i.test(error.message)) {
        throw new Error(`Failed to create "${bucket}" bucket: ${error.message}`);
      }
    }
  }

  // 3. Schema + bootstrap user
  if (dryRun) {
    console.log(`[dry-run] Would apply schema.sql and create bootstrap user ${bootstrapEmail}`);
  } else {
    console.log('Applying schema and creating bootstrap user...');
    await applySchemaAndBootstrap({
      databaseUrl,
      supabaseUrl,
      serviceRoleKey,
      bootstrapName,
      bootstrapEmail,
      bootstrapPassword,
      log: console.log,
    });
  }

  // 4. Netlify site, linked to this repo so its own build pipeline (per
  // netlify.toml) handles the deploy exactly like the existing production
  // instance already does.
  let site;
  if (dryRun) {
    console.log(`[dry-run] Would create Netlify site "${projectSlug}" linked to ${githubRepo}#${branch}`);
    site = { id: '<site-id-placeholder>', ssl_url: `https://${projectSlug}.netlify.app` };
  } else {
    console.log('Creating Netlify site...');
    site = await netlify.createSite(netlifyAuthToken, {
      siteName: projectSlug,
      githubRepo,
      branch,
      accountSlug: netlifyAccountSlug,
    });
  }

  const clientOrigin = args['client-origin'] || site.ssl_url;

  const envVars = {
    NODE_ENV: 'production',
    SUPABASE_URL: supabaseUrl,
    SUPABASE_ANON_KEY: anonKey,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    DATABASE_URL: databaseUrl,
    CLIENT_ORIGIN: clientOrigin,
    VITE_SUPABASE_URL: supabaseUrl,
    VITE_SUPABASE_ANON_KEY: anonKey,
    ...branding,
  };

  if (dryRun) {
    console.log('[dry-run] Would set these Netlify env vars:');
    for (const [key, value] of Object.entries(envVars)) {
      console.log(`  ${key}=${REDACTED_KEY_PATTERN.test(key) ? '<redacted>' : value}`);
    }
    console.log('[dry-run] Would trigger an initial build/deploy');
  } else {
    console.log('Setting Netlify env vars...');
    await netlify.setEnvVars(netlifyAuthToken, site.id, envVars);
    console.log('Triggering initial build...');
    await netlify.triggerBuild(netlifyAuthToken, site.id);
  }

  console.log('\n=== Done ===');
  console.log(`Supabase project ref: ${ref}`);
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`Netlify site: ${site.ssl_url || site.url}`);
  console.log(`Bootstrap login: ${bootstrapEmail} / ${bootstrapPassword}`);
  console.log('Save the bootstrap password somewhere safe now — it is only printed this once.');
  console.log('\nStill manual: pointing a custom domain at the Netlify site (see DEPLOYMENT.md, "Custom domain").');
}

main().catch((err) => {
  console.error('\nProvisioning failed:', err.message);
  process.exitCode = 1;
});
