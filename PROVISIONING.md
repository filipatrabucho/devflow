# Automated client provisioning

`server/scripts/provision-client.mjs` automates the manual steps in
`DEPLOYMENT.md` (create Supabase project → storage buckets → schema →
bootstrap user → Netlify site → env vars → first deploy) into a single
command, for when you're onboarding clients one after another rather than
setting up the one PKF instance by hand.

It always creates a **new, fully isolated** Supabase project and Netlify
site per client — same "Option A" tenancy model the app already assumes.
Nothing about an existing client's data is ever touched by a run for another
client.

## Prerequisites (one-time, not per client)

1. **A Supabase access token** with permission to create projects in your
   organization: Supabase dashboard → Account → Access Tokens → Generate.
2. **Your Supabase organization ID**: Supabase dashboard → Organization →
   Settings, or `GET https://api.supabase.com/v1/organizations` with your
   access token.
3. **A Netlify personal access token**: Netlify dashboard → User settings →
   Applications → New access token.
4. **This repo's GitHub account/org connected to Netlify at least once**:
   Netlify → Team settings → Git Providers → GitHub. This is a one-time,
   interactive OAuth step per Netlify account — there's no pure-API way
   around it. Once done, every subsequent `provision-client.mjs` run can
   create repo-linked sites via the API without repeating it.

Export the two tokens as environment variables before running (never pass
them as CLI flags — those can end up in shell history):

```bash
export SUPABASE_ACCESS_TOKEN=sbp_...
export NETLIFY_AUTH_TOKEN=nfp_...
export SUPABASE_ORG_ID=...   # or pass --supabase-org-id each time
```

## Usage

```bash
cd server
npm run provision -- \
  --client-name "Acme Corp" \
  --github-repo your-org/devflow \
  --bootstrap-email admin@acme.com \
  --app-name "Acme Flow" \
  --primary-color "#0057ff"
```

**Always try `--dry-run` first**, especially the first time you use this
against a real Supabase organization — it runs the exact same logic and
prints every step and the full env var list it would set, without making
any network call:

```bash
npm run provision -- --client-name "Acme Corp" --github-repo your-org/devflow \
  --bootstrap-email admin@acme.com --dry-run
```

### Flags

| Flag | Required | Default | Notes |
|---|---|---|---|
| `--client-name` | yes | — | Human name, e.g. `"Acme Corp"` |
| `--github-repo` | yes | — | `"owner/repo"` to link the new Netlify site to |
| `--bootstrap-email` | yes | — | First login for this client (role: Senior) |
| `--project-slug` | no | slugified `--client-name` | Used as both the Supabase project name and the Netlify site name |
| `--supabase-org-id` | yes* | `SUPABASE_ORG_ID` env var | *unless set via env var |
| `--region` | no | `eu-west-1` | Supabase project region |
| `--branch` | no | `main` | Git branch Netlify builds from |
| `--netlify-account-slug` | no | Netlify default team | Only needed for multi-team Netlify accounts |
| `--bootstrap-name` | no | `Admin` | Display name for the first account |
| `--bootstrap-password` | no | randomly generated | Printed once at the end — save it |
| `--db-password` | no | randomly generated | Postgres password for the new Supabase project |
| `--client-origin` | no | the new Netlify site's URL | Set this instead once the client has a custom domain |
| `--app-name`, `--tagline`, `--primary-color`, `--primary-hover-color`, `--primary-light-color`, `--logo-url`, `--favicon-url` | no | DevFlow defaults | Seeds the same white-label env vars documented in `DEPLOYMENT.md` — the client's Admin can still change all of these later from the in-app Branding page |
| `--dry-run` | no | off | Prints every planned step/env var, makes no network calls |

## What it does, in order

1. Creates a new Supabase project (`POST /v1/projects`) and waits for it to
   report `ACTIVE_HEALTHY`.
2. Creates the `avatars` and `branding` public Storage buckets on it.
3. Runs the same `applySchemaAndBootstrap` logic as `npm run db:init` against
   it: applies `server/sql/schema.sql`, then creates the bootstrap Supabase
   Auth user and its `profiles` row (role `senior`).
4. Creates a Netlify site linked to the given GitHub repo/branch, using the
   same build command/publish dir/functions dir as the repo's `netlify.toml`
   — so Netlify's normal build pipeline (identical to how the existing
   production instance deploys) takes it from there.
5. Sets that site's env vars (`SUPABASE_URL`, `SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `CLIENT_ORIGIN`, the client's
   `VITE_*` branding vars).
6. Triggers the first build.

## What's still manual

- **Pointing a custom domain** at the new Netlify site — DNS is the client's
  own, so this can't be automated. See `DEPLOYMENT.md`, "Custom domain".
  Once you know it, re-run `PATCH /sites/{id}` yourself or just update
  `CLIENT_ORIGIN` in the Netlify dashboard and re-deploy.
- **The one-time GitHub↔Netlify connection** described in Prerequisites
  above — only needed once per Netlify account, not per client.

## Testing notes

This script's Supabase/Netlify API calls have not been exercised against a
real Supabase organization or Netlify account (no live credentials were
available while writing it) — only `--dry-run`, which verifies the full
control flow, argument handling, and env var construction. The
`applySchemaAndBootstrap` step it calls into, and the API endpoint shapes
themselves, are otherwise the same ones already used and documented
elsewhere in this repo (`server/sql/init.js`, Supabase's and Netlify's
public API docs). Run `--dry-run` first, then a real run against a
throwaway/test client, before trusting it for a paying customer.
