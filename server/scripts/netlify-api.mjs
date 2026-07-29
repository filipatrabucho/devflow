// Thin wrapper around the Netlify API (https://api.netlify.com/api/v1),
// used to create a new site per client and point it at this same repo, so
// each client gets their own build (and their own env vars/branding) off a
// single shared codebase. Docs: https://open-api.netlify.com/
//
// Requires a personal access token (Netlify dashboard → User settings →
// Applications → New access token), passed in as `accessToken`. Never
// hardcode this token; it's read from NETLIFY_AUTH_TOKEN by the CLI.

const API_BASE = 'https://api.netlify.com/api/v1';

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
    const message = data?.message || res.statusText;
    throw new Error(`Netlify API ${method} ${pathname} failed (${res.status}): ${message}`);
  }
  return data;
}

// Creates a Netlify site linked to a GitHub repo, using the same build
// command / publish dir / functions dir as netlify.toml at the repo root, so
// Netlify's normal build pipeline (the one already proven in production)
// handles the rest — no custom deploy/zip logic needed here.
//
// NOTE: repo-linked site creation via this API only succeeds if the Netlify
// account already has that GitHub repo (or the whole GitHub account/org)
// connected — normally a one-time, per-Netlify-account interactive step
// (Team settings -> Git Providers -> GitHub). If that hasn't been done yet,
// Netlify's API responds with an error asking for it; there is no pure-API
// way around that first-time OAuth step, so the CLI surfaces this error
// as-is rather than pretending to recover from it.
export async function createSite(accessToken, { siteName, githubRepo, branch = 'main', accountSlug }) {
  const body = {
    name: siteName,
    repo: {
      provider: 'github',
      repo: githubRepo,
      branch,
      cmd: 'npm --prefix server install && npm --prefix client install && npm --prefix client run build',
      dir: 'client/dist',
      functions_dir: 'netlify/functions',
    },
  };
  const pathname = accountSlug ? `/${accountSlug}/sites` : '/sites';
  return request(accessToken, 'POST', pathname, body);
}

// Sets/overwrites the site's build environment variables in one shot. These
// are available both at build time (so VITE_* branding vars reach the client
// bundle) and at runtime to the Netlify Function powering /api/* (so
// SUPABASE_URL etc. reach the Express app via serverless-http).
export async function setEnvVars(accessToken, siteId, envVars) {
  return request(accessToken, 'PATCH', `/sites/${siteId}`, {
    build_settings: { env: envVars },
  });
}

// Triggers a fresh build/deploy — needed once after setEnvVars, since
// changing env vars doesn't itself kick off a new build.
export async function triggerBuild(accessToken, siteId) {
  return request(accessToken, 'POST', `/sites/${siteId}/builds`, {});
}
