-- DevFlow database schema (MySQL / MariaDB)
-- Safe to re-run: every statement is idempotent, so this also upgrades an
-- existing installation in place (used by `npm run db:init`).

CREATE DATABASE IF NOT EXISTS devflow
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE devflow;

-- Roles are configurable at runtime (label + permission flags can be edited
-- from the app's Roles settings page); the four `key_name` values below are
-- the fixed set the rest of the app knows about.
CREATE TABLE IF NOT EXISTS roles (
  id                      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  key_name                VARCHAR(30)  NOT NULL UNIQUE,
  label                   VARCHAR(100) NOT NULL,
  can_manage_users        TINYINT(1)   NOT NULL DEFAULT 0,
  can_manage_developments TINYINT(1)   NOT NULL DEFAULT 0,
  can_manage_tasks        TINYINT(1)   NOT NULL DEFAULT 0,
  can_view_all_tasks      TINYINT(1)   NOT NULL DEFAULT 0,
  can_validate_tasks      TINYINT(1)   NOT NULL DEFAULT 0,
  created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Upgrade path for installations created before task validation existed.
-- (init.js additionally defaults senior/admin to 1 the first time this runs.)
ALTER TABLE roles ADD COLUMN IF NOT EXISTS can_validate_tasks TINYINT(1) NOT NULL DEFAULT 0 AFTER can_view_all_tasks;

INSERT IGNORE INTO roles
  (key_name, label, can_manage_users, can_manage_developments, can_manage_tasks, can_view_all_tasks, can_validate_tasks)
VALUES
  ('senior',    'Senior',    1, 1, 1, 1, 1),
  ('admin',     'Admin',     1, 1, 1, 1, 1),
  ('partner',   'Partner',   0, 1, 0, 1, 0),
  ('developer', 'Developer', 0, 0, 0, 0, 0);

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120)  NOT NULL,
  email         VARCHAR(190)  NOT NULL UNIQUE,
  password_hash VARCHAR(255)  NOT NULL,
  role          VARCHAR(30)   NOT NULL DEFAULT 'developer',
  avatar_path   VARCHAR(255)  NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Upgrade path for installations created before roles existed (was an ENUM).
ALTER TABLE users MODIFY COLUMN role VARCHAR(30) NOT NULL DEFAULT 'developer';

CREATE TABLE IF NOT EXISTS developments (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name             VARCHAR(160) NOT NULL,
  description      TEXT NULL,
  phase            ENUM('waiting_list', 'in_search', 'in_development', 'in_production')
                     NOT NULL DEFAULT 'waiting_list',
  start_date       DATE NULL,
  questions        TEXT NULL,
  observations     TEXT NULL,
  requested_at     DATE NULL,
  hours_estimate   VARCHAR(50) NULL,
  completion_notes VARCHAR(500) NULL,
  created_by       INT UNSIGNED NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_developments_created_by
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Upgrade path for installations created before start_date existed.
ALTER TABLE developments ADD COLUMN IF NOT EXISTS start_date DATE NULL AFTER phase;

-- Upgrade path for installations created before the Excel-import fields existed.
ALTER TABLE developments ADD COLUMN IF NOT EXISTS questions TEXT NULL AFTER start_date;
ALTER TABLE developments ADD COLUMN IF NOT EXISTS observations TEXT NULL AFTER questions;
ALTER TABLE developments ADD COLUMN IF NOT EXISTS requested_at DATE NULL AFTER observations;
ALTER TABLE developments ADD COLUMN IF NOT EXISTS hours_estimate VARCHAR(50) NULL AFTER requested_at;
ALTER TABLE developments ADD COLUMN IF NOT EXISTS completion_notes VARCHAR(500) NULL AFTER hours_estimate;

CREATE TABLE IF NOT EXISTS tasks (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  development_id INT UNSIGNED NOT NULL,
  title          VARCHAR(200) NOT NULL,
  description    TEXT NULL,
  phase          ENUM('not_started', 'in_progress', 'in_validation', 'approved', 'done')
                   NOT NULL DEFAULT 'not_started',
  assigned_to    INT UNSIGNED NULL,
  validated_by   INT UNSIGNED NULL,
  validated_at   DATETIME NULL,
  created_by     INT UNSIGNED NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tasks_development
    FOREIGN KEY (development_id) REFERENCES developments(id) ON DELETE CASCADE,
  CONSTRAINT fk_tasks_assigned_to
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_tasks_validated_by
    FOREIGN KEY (validated_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_tasks_created_by
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Upgrade path for installations created before validation tracking existed.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS validated_by INT UNSIGNED NULL AFTER assigned_to;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS validated_at DATETIME NULL AFTER validated_by;

CREATE INDEX IF NOT EXISTS idx_tasks_development ON tasks(development_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);

-- Comment history for a task: manual notes plus an automatic entry (is_system=1)
-- every time its phase changes, so there's always a record of why it moved.
CREATE TABLE IF NOT EXISTS task_comments (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  task_id    INT UNSIGNED NOT NULL,
  author_id  INT UNSIGNED NULL,
  body       TEXT NOT NULL,
  is_system  TINYINT(1) NOT NULL DEFAULT 0,
  event_type VARCHAR(20) NULL,
  from_phase VARCHAR(30) NULL,
  to_phase   VARCHAR(30) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_task_comments_task
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  CONSTRAINT fk_task_comments_author
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Upgrade path for installations created before phase-transition metadata existed.
ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS event_type VARCHAR(20) NULL AFTER is_system;
ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS from_phase VARCHAR(30) NULL AFTER event_type;
ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS to_phase VARCHAR(30) NULL AFTER from_phase;

CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);
