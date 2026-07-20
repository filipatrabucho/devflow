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
  automatic system entry every time its phase changes (who moved it, from where,
  to where, and — if supplied — why), so a task sent backwards always has a paper
  trail explaining the decision.
- Login is email + password. Only `@pkf.pt` addresses are accepted.
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
- **Backend**: Node.js + Express 5, MySQL2, JWT auth in an httpOnly cookie, bcrypt password hashing
- **Database**: MySQL / MariaDB

## Project layout

```
server/   Express API (auth, users, developments, tasks, avatar uploads)
client/   React app (Vite)
```

## 1. Database setup

Requires a running MySQL or MariaDB server.

```bash
cd server
cp .env.example .env
```

Edit `.env`:
- Set `DB_USER` / `DB_PASSWORD` to a MySQL/MariaDB user that can create databases
  (or pre-create the `devflow` database/user yourself and adjust `DB_NAME`).
- Set a long random `JWT_SECRET`.
- Set `BOOTSTRAP_SENIOR_EMAIL` / `BOOTSTRAP_SENIOR_PASSWORD` — this is the **first**
  account created for you, since new accounts can otherwise only be created from
  inside the app. The email must end with `@pkf.pt`.

Then create the schema and bootstrap the first senior user:

```bash
npm install
npm run db:init
```

Re-running `db:init` is safe: every statement in `schema.sql` is idempotent, so
it also upgrades an existing installation in place (adding the `roles` table,
new columns, etc.) without touching your existing data, and only creates the
bootstrap user if the `users` table is empty.

## 2. Run the API

```bash
cd server
npm run dev      # http://localhost:4000
```

## 3. Run the frontend

```bash
cd client
npm install
npm run dev       # http://localhost:5173
```

The Vite dev server proxies `/api` and `/uploads` to `http://localhost:4000`, so
just open `http://localhost:5173` and log in with the bootstrap senior account.

## Security notes

- Passwords are hashed with bcrypt (cost 12); never stored or logged in plain text.
- Sessions use a JWT in an `httpOnly`, `SameSite=Strict` cookie (not readable by
  JS, and not sent on cross-site requests) — set `secure: true` automatically
  in production (requires HTTPS).
- The login endpoint is rate-limited; all `/api` routes have a general rate limit too.
- All SQL is parameterized (no string-built queries).
- Avatar uploads are limited to PNG/JPEG/WEBP, capped at 2MB, and stored under a
  randomly generated filename.
- Every write endpoint re-validates the caller's role/ownership server-side —
  the UI hides controls the user shouldn't see, but permissions are enforced by
  the API regardless of what the client sends.

## Building for production

```bash
cd client
npm run build      # outputs client/dist — serve behind your web server / reverse proxy
```

Serve `client/dist` from your web server (or any static host) and point it at the
API (set `CLIENT_ORIGIN` in the server `.env` to that origin, and run the API
behind HTTPS with `NODE_ENV=production` so the auth cookie gets `secure: true`).
