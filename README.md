# DevFlow

Internal task management app for the engineering team. Managers create developer
accounts and assign tasks; developers track their work through its phases.

- **Developments** move through: Waiting List → In Search → In Development → In Production,
  and track both a creation date and an editable start date. Renamable and deletable
  (with all of their tasks) by anyone with Manage developments.
- **Tasks** (belong to a development, optionally assigned to a user) move through:
  Not Started → In Progress → In Validation → Approved → Done. Once a task reaches
  Approved/Done it locks to a read-only badge showing who validated it and when;
  a "Reopen" button (Manage tasks or Validate tasks) sends it back to In Validation
  if it was approved by mistake. Title/description are editable and tasks are
  deletable (Manage tasks).
- Every task/development board is also viewable as a Notion-style **drag-and-drop
  Kanban board**, in addition to the plain list view.
- Every task has a **comment/history thread**: manual notes from anyone, plus an
  automatic system entry every time its phase changes — who did it, and a plain
  label (Rejected in red, Approved/Done in green, Reopened in amber, or a generic
  Moved) plus the optional note they gave, so a task sent backwards always has a
  paper trail explaining the decision. Click any task card on the **All Tasks**
  board to see its full details and comment thread in a modal.
- **Bulk-import developments from Excel** (Manage developments): upload an
  `.xlsx` with columns `Tema`, `Descrição`, `Questões`, `Observações`,
  `Data Pedido`, `Horas`, `Data Conclusão`, `Estado` — one development is created
  per row. `Estado` is matched (accent/case-insensitive) to a phase, defaulting to
  Waiting List with a warning if it isn't recognized; unparseable dates are
  skipped with a warning rather than failing the row. Rows without a `Tema` are
  silently skipped. The import summary lists what was created and what warnings
  or skips happened, per row.
- Login is email + password (handled by Supabase Auth).
- There is no public sign-up — accounts are created from inside the app (Users page),
  and an existing user's role can be changed at any time from the same page.

## Roles & permissions

Four roles ship by default — **Senior**, **Admin**, **Partner**, **Developer** —
each with five independent permission flags:

| Role      | Manage users | Manage developments | Manage tasks | View all tasks | Validate tasks |
|-----------|:---:|:---:|:---:|:---:|:---:|
| Senior    | ✅ | ✅ | ✅ | ✅ | ✅ |
| Admin     | ✅ | ✅ | ✅ | ✅ | ✅ |
| Partner   |    | ✅ | | ✅ (read-only) | |
| Developer |    | | | | |

- **Manage users**: create/remove users and change anyone's role (the only accounts
  that can create new users, or new roles).
- **Manage developments**: create/edit developments and their phase.
- **Manage tasks**: create tasks, assign/reassign them, edit any field, and move a
  task into Approved/Done. A developer can still move their own assigned tasks
  through Not Started → In Progress → In Validation.
- **View all tasks**: access the "All Tasks" board across every development. Only
  a role with **Manage tasks** can drag cards there — everyone else sees it read-only.
- **Validate tasks**: a dedicated reviewer role. See every task waiting in
  **In Validation** (own "Validation" page, across all developments regardless of
  assignment) and Approve or Reject (send back to In Progress) with an optional
  note — without needing full Manage tasks access to create/reassign/delete tasks.

Roles are fully editable at runtime from the in-app **Roles** page (visible to
anyone with Manage users): rename any role, toggle its permissions, or add/remove
custom roles entirely — the four defaults above are just a starting point, not a
fixed set.

## Stack

- **Frontend**: React 19 + Vite 8 + React Router 7, plain CSS (no UI framework)
- **Backend**: Node.js + Express 5, deployable as a single Netlify Function (`serverless-http`)
- **Database**: Postgres (Supabase)
- **Auth**: Supabase Auth (email/password); the browser talks to Supabase directly
  for sign-in/out, then sends the resulting access token as a Bearer header to
  our own API for everything else
- **Storage**: Supabase Storage (avatar uploads)

## Project layout

```
server/             Express API (users, developments, tasks, roles) — also runs locally
netlify/functions/   Netlify Function wrapper around the same Express app
client/              React app (Vite)
netlify.toml         Netlify build + redirect config
```

## Local development

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for the full walkthrough (creating the
Supabase project, running the schema, setting up Netlify). Short version once
you have a Supabase project:

```bash
cd server
cp .env.example .env   # fill in SUPABASE_URL, SUPABASE_*_KEY, DATABASE_URL
npm install
npm run db:init         # applies schema.sql, optionally creates a bootstrap senior user
npm run dev              # http://localhost:4000

cd ../client
cp .env.example .env    # fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
npm install
npm run dev               # http://localhost:5173
```

Re-running `db:init` is safe: every statement in `schema.sql` is idempotent, so
it also upgrades an existing installation in place without touching existing
data, and only creates the bootstrap user if the `profiles` table is empty.

## Security notes

- Passwords, sessions and tokens are entirely managed by Supabase Auth; the API
  never sees or stores a password.
- The API verifies every request's Supabase access token server-side
  (`supabase.auth.getUser`) before trusting `req.user`.
- All SQL is parameterized (no string-built queries).
- Avatar uploads are limited to PNG/JPEG/WEBP, capped at 2MB, and stored under a
  randomly generated object name in a private-by-default Supabase Storage bucket.
- Every write endpoint re-validates the caller's role/ownership server-side —
  the UI hides controls the user shouldn't see, but permissions are enforced by
  the API regardless of what the client sends.

## Deploying (Netlify + Supabase)

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for step-by-step instructions.
