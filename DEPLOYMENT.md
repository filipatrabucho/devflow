# Deploying DevFlow (Netlify + Supabase)

Follow these steps in order. Steps 1-3 are done in the Supabase/Netlify dashboards
in your browser; steps 4-6 are commands you run locally.

## 1. Create the Supabase project

1. Go to https://supabase.com/dashboard → **New project**.
2. Pick an organization, a name (e.g. `devflow`), a database password (save it —
   you'll need it for `DATABASE_URL` below), and a region. Wait for it to finish
   provisioning (a couple of minutes).
3. Go to **Project Settings → API**. Note down:
   - `Project URL` → this is `SUPABASE_URL` / `VITE_SUPABASE_URL`
   - `anon public` key → this is `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY`
   - `service_role` key (click "Reveal") → this is `SUPABASE_SERVICE_ROLE_KEY`.
     **Never expose this one to the browser** — server/Netlify env vars only.
4. Go to **Project Settings → Database → Connection string**, tab **URI**. Copy
   it and replace `[YOUR-PASSWORD]` with the database password from step 2 —
   this is `DATABASE_URL`. Use the **Session pooler** connection string if given
   the choice (works better from a serverless environment than the direct one).

## 2. Create the avatars storage bucket

1. Go to **Storage** in the Supabase dashboard → **New bucket**.
2. Name it exactly `avatars`, and toggle **Public bucket** ON (the app links to
   avatars directly via their public URL — no bucket-level secrets are stored
   there, only images).

## 3. Apply the database schema + create the first user

You need Node installed locally for this one-time step.

```bash
cd server
cp .env.example .env
```

Edit `server/.env` and fill in the four Supabase values from step 1
(`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`),
plus `BOOTSTRAP_SENIOR_EMAIL` / `BOOTSTRAP_SENIOR_PASSWORD` for the first account
you'll log in with (any email address now works, not just `@pkf.pt`).

```bash
npm install
npm run db:init
```

This creates all the tables (idempotent — safe to re-run later after a schema
update) and, the first time, creates your bootstrap Supabase Auth user plus its
`profiles` row with the `senior` role.

## 4. Push the code

Make sure everything from this session is pushed to your GitHub repo (already
done if you're reading this after the migration commit).

## 5. Create the Netlify site

1. Go to https://app.netlify.com → **Add new site → Import an existing project**,
   pick GitHub, and select the `devflow` repo and this branch.
2. Netlify should auto-detect the build settings from `netlify.toml` at the repo
   root (build command, publish directory `client/dist`, functions directory).
   You don't need to change anything in the UI build settings.
3. Before the first deploy (or right after, then redeploy), go to
   **Site configuration → Environment variables** and add:

   | Key | Value |
   |---|---|
   | `SUPABASE_URL` | from step 1 |
   | `SUPABASE_ANON_KEY` | from step 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | from step 1 |
   | `DATABASE_URL` | from step 1 |
   | `VITE_SUPABASE_URL` | same as `SUPABASE_URL` |
   | `VITE_SUPABASE_ANON_KEY` | same as `SUPABASE_ANON_KEY` |
   | `CLIENT_ORIGIN` | your Netlify site URL, e.g. `https://your-site.netlify.app` (fill in after the first deploy gives you the URL, then redeploy) |

4. Trigger a deploy (or it runs automatically on push).

## 6. Verify

Open the Netlify URL, log in with the bootstrap senior account from step 3, and
confirm: login works, Developments/Tasks load, and creating a new user / task
works end-to-end.

## Notes / things worth knowing

- Login and sessions are handled entirely by Supabase Auth in the browser; our
  own API only ever sees a bearer token it verifies server-side, it never
  touches passwords.
- The whole Express API runs as a single Netlify Function
  (`netlify/functions/api.js`), reached via the `/api/*` redirect in
  `netlify.toml`.
- `npm run db:init` is safe to re-run any time you pull schema changes — it
  only adds/upgrades, never drops data.
- This migration was written and syntax/build-checked locally, but could not be
  tested end-to-end against a real Supabase project or a real Netlify
  deployment in this environment (no credentials/dashboard access here) — please
  do a full click-through after your first deploy, and ping back with the
  first error you hit if anything doesn't work exactly as described above.
