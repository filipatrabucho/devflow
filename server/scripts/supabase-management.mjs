// Thin wrapper around the Supabase Management API (https://api.supabase.com),
// used to spin up a brand-new, fully isolated Supabase project per client —
// the "Option A" tenancy model this app already assumes (see DEPLOYMENT.md).
// Docs: https://supabase.com/docs/reference/api/introduction
//
// Requires a personal/organization access token with project-creation rights
// (Supabase dashboard → Account → Access Tokens), passed in as `accessToken`.
// Never hardcode this token; it's read from SUPABASE_ACCESS_TOKEN by the CLI.

const API_BASE = 'https://api.supabase.com/v1';

async function request(accessToken, method, pathname, body) {
  const res = await fetch(`${API_BASE}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message = data?.message || data?.error || res.statusText;
    throw new Error(`Supabase Management API ${method} ${pathname} failed (${res.status}): ${message}`);
  }
  return data;
}

// Creates a new Supabase project. Returns the raw API response, whose `id`
// field is the project "ref" used in its URL (https://{ref}.supabase.co) and
// in every subsequent Management API call for this project.
export async function createProject(accessToken, { organizationId, name, region, dbPassword, plan = 'free' }) {
  return request(accessToken, 'POST', '/projects', {
    organization_id: organizationId,
    name,
    region,
    db_pass: dbPassword,
    plan,
  });
}

export async function getProject(accessToken, ref) {
  return request(accessToken, 'GET', `/projects/${ref}`);
}

// Supabase projects take a couple of minutes to provision. Polls until the
// project reports healthy, or throws after `timeoutMs`.
export async function waitUntilActive(accessToken, ref, { timeoutMs = 5 * 60 * 1000, intervalMs = 5000, log = () => {} } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const project = await getProject(accessToken, ref);
    log(`Project ${ref} status: ${project.status}`);
    if (project.status === 'ACTIVE_HEALTHY') {
      return project;
    }
    if (project.status === 'INIT_FAILED' || project.status === 'REMOVED') {
      throw new Error(`Project ${ref} failed to provision (status: ${project.status})`);
    }
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for project ${ref} to become active (last status: ${project.status})`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

// Returns { anonKey, serviceRoleKey } for the given project.
export async function getApiKeys(accessToken, ref) {
  const keys = await request(accessToken, 'GET', `/projects/${ref}/api-keys`);
  const anon = keys.find((k) => k.name === 'anon');
  const serviceRole = keys.find((k) => k.name === 'service_role');
  if (!anon || !serviceRole) {
    throw new Error(`Could not find anon/service_role API keys for project ${ref}`);
  }
  return { anonKey: anon.api_key, serviceRoleKey: serviceRole.api_key };
}

// Direct (non-pooled) Postgres connection string — always available
// immediately once the project is ACTIVE_HEALTHY, unlike the pooler
// endpoint, which is fine for schema application and normal app traffic.
export function buildDatabaseUrl(ref, dbPassword) {
  return `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${ref}.supabase.co:5432/postgres`;
}

export function projectUrl(ref) {
  return `https://${ref}.supabase.co`;
}
