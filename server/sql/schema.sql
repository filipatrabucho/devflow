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
  created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT IGNORE INTO roles
  (key_name, label, can_manage_users, can_manage_developments, can_manage_tasks, can_view_all_tasks)
VALUES
  ('senior',    'Senior',    1, 1, 1, 1),
  ('admin',     'Admin',     1, 1, 1, 1),
  ('partner',   'Partner',   0, 1, 0, 1),
  ('developer', 'Developer', 0, 0, 0, 0);

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
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(160) NOT NULL,
  description TEXT NULL,
  phase       ENUM('waiting_list', 'in_search', 'in_development', 'in_production')
                NOT NULL DEFAULT 'waiting_list',
  start_date  DATE NULL,
  created_by  INT UNSIGNED NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_developments_created_by
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Upgrade path for installations created before start_date existed.
ALTER TABLE developments ADD COLUMN IF NOT EXISTS start_date DATE NULL AFTER phase;

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
