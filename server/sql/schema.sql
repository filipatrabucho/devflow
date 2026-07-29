-- DevFlow database schema (Postgres / Supabase)
-- Safe to re-run: every statement is idempotent, so this also upgrades an
-- existing installation in place (used by `npm run db:init`).
--
-- Auth is handled by Supabase Auth (auth.users). `profiles` is our own
-- application-level record for each auth user (name, role, avatar).

-- Roles are configurable at runtime (label + permission flags can be edited
-- from the app's Roles settings page); the four `key_name` values below are
-- the fixed set the rest of the app knows about.
CREATE TABLE IF NOT EXISTS roles (
  id                      SERIAL PRIMARY KEY,
  key_name                VARCHAR(30)  NOT NULL UNIQUE,
  label                   VARCHAR(100) NOT NULL,
  can_manage_users        BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_developments BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_tasks        BOOLEAN NOT NULL DEFAULT FALSE,
  can_view_all_tasks      BOOLEAN NOT NULL DEFAULT FALSE,
  can_validate_tasks      BOOLEAN NOT NULL DEFAULT FALSE,
  is_staff                BOOLEAN NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE roles ADD COLUMN IF NOT EXISTS can_validate_tasks BOOLEAN NOT NULL DEFAULT FALSE;
-- Whether this role counts as "staff" for the Dashboard's "no pending tasks
-- assigned" widget (init.js defaults 'developer' to true the first time this
-- column is added; admins can change it from the Roles page afterwards).
ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_staff BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO roles
  (key_name, label, can_manage_users, can_manage_developments, can_manage_tasks, can_view_all_tasks, can_validate_tasks, is_staff)
VALUES
  ('senior',    'Senior',    TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  FALSE),
  ('admin',     'Admin',     TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  FALSE),
  ('partner',   'Partner',   FALSE, TRUE,  FALSE, TRUE,  FALSE, FALSE),
  ('developer', 'Developer', FALSE, FALSE, FALSE, FALSE, FALSE, TRUE)
ON CONFLICT (key_name) DO NOTHING;

-- One row per Supabase Auth user (auth.users.id). Login/password are
-- handled entirely by Supabase Auth; this table only holds app profile data.
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name          VARCHAR(120)  NOT NULL,
  email         VARCHAR(190)  NOT NULL UNIQUE,
  role          VARCHAR(30)   NOT NULL DEFAULT 'developer',
  avatar_path   TEXT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS developments (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(160) NOT NULL,
  description      TEXT NULL,
  phase            VARCHAR(30) NOT NULL DEFAULT 'waiting_list'
                     CHECK (phase IN ('waiting_list', 'in_search', 'in_development', 'in_production')),
  start_date       DATE NULL,
  questions        TEXT NULL,
  observations     TEXT NULL,
  requested_at     DATE NULL,
  hours_estimate   VARCHAR(50) NULL,
  completion_notes VARCHAR(500) NULL,
  created_by       UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE developments ADD COLUMN IF NOT EXISTS start_date DATE NULL;
ALTER TABLE developments ADD COLUMN IF NOT EXISTS questions TEXT NULL;
ALTER TABLE developments ADD COLUMN IF NOT EXISTS observations TEXT NULL;
ALTER TABLE developments ADD COLUMN IF NOT EXISTS requested_at DATE NULL;
ALTER TABLE developments ADD COLUMN IF NOT EXISTS hours_estimate VARCHAR(50) NULL;
ALTER TABLE developments ADD COLUMN IF NOT EXISTS completion_notes VARCHAR(500) NULL;

CREATE TABLE IF NOT EXISTS tasks (
  id             SERIAL PRIMARY KEY,
  development_id INTEGER NOT NULL REFERENCES developments(id) ON DELETE CASCADE,
  title          VARCHAR(200) NOT NULL,
  description    TEXT NULL,
  phase          VARCHAR(30) NOT NULL DEFAULT 'not_started'
                   CHECK (phase IN ('not_started', 'in_progress', 'in_validation', 'approved', 'done')),
  assigned_to    UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
  validated_by   UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
  validated_at   TIMESTAMPTZ NULL,
  created_by     UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS validated_by UUID NULL REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_development ON tasks(development_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);

-- Comment history for a task: manual notes plus an automatic entry (is_system=true)
-- every time its phase changes, so there's always a record of why it moved.
CREATE TABLE IF NOT EXISTS task_comments (
  id         SERIAL PRIMARY KEY,
  task_id    INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id  UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
  body       TEXT NOT NULL,
  is_system  BOOLEAN NOT NULL DEFAULT FALSE,
  event_type VARCHAR(20) NULL,
  from_phase VARCHAR(30) NULL,
  to_phase   VARCHAR(30) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS event_type VARCHAR(20) NULL;
ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS from_phase VARCHAR(30) NULL;
ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS to_phase VARCHAR(30) NULL;

CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);

-- Single-row table (id is always 1) holding the white-label branding for
-- this instance: app name, tagline, brand colors, logo/favicon. Editable at
-- runtime from the in-app Branding settings page (admin role only), so a
-- client doesn't need a redeploy just to change these.
CREATE TABLE IF NOT EXISTS branding_settings (
  id                   SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  app_name             VARCHAR(60)  NOT NULL DEFAULT 'DevFlow',
  tagline              VARCHAR(160) NOT NULL DEFAULT 'Task management for engineering teams',
  primary_color        VARCHAR(20)  NOT NULL DEFAULT '#552f86',
  primary_hover_color  VARCHAR(20)  NOT NULL DEFAULT '#40166d',
  primary_light_color  VARCHAR(20)  NOT NULL DEFAULT '#9769dc',
  logo_url             TEXT NULL,
  favicon_url          TEXT NULL,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO branding_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- `updated_at` auto-touch, since Postgres has no `ON UPDATE CURRENT_TIMESTAMP`.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_roles_updated_at ON roles;
CREATE TRIGGER trg_roles_updated_at BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_developments_updated_at ON developments;
CREATE TRIGGER trg_developments_updated_at BEFORE UPDATE ON developments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_branding_settings_updated_at ON branding_settings;
CREATE TRIGGER trg_branding_settings_updated_at BEFORE UPDATE ON branding_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON tasks;
CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
