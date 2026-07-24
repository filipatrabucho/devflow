import pool from './db.js';

const CACHE_TTL_MS = 5000;
let cache = null;
let cachedAt = 0;

const COLUMN_TO_KEY = {
  can_manage_users: 'manageUsers',
  can_manage_developments: 'manageDevelopments',
  can_manage_tasks: 'manageTasks',
  can_view_all_tasks: 'viewAllTasks',
  can_validate_tasks: 'validateTasks',
};

export function invalidateRoleCache() {
  cache = null;
}

export async function getRoles() {
  const now = Date.now();
  if (cache && now - cachedAt < CACHE_TTL_MS) return cache;

  const [rows] = await pool.query(
    `SELECT key_name AS "keyName", label, can_manage_users, can_manage_developments,
            can_manage_tasks, can_view_all_tasks, can_validate_tasks
     FROM roles ORDER BY id ASC`
  );

  cache = rows.map((row) => ({
    key: row.keyName,
    label: row.label,
    permissions: {
      manageUsers: !!row.can_manage_users,
      manageDevelopments: !!row.can_manage_developments,
      manageTasks: !!row.can_manage_tasks,
      viewAllTasks: !!row.can_view_all_tasks,
      validateTasks: !!row.can_validate_tasks,
    },
  }));
  cachedAt = now;
  return cache;
}

export async function getRoleByKey(key) {
  const roles = await getRoles();
  return roles.find((r) => r.key === key) || null;
}

export async function getPermissionsFor(roleKey) {
  const role = await getRoleByKey(roleKey);
  return role?.permissions || {
    manageUsers: false,
    manageDevelopments: false,
    manageTasks: false,
    viewAllTasks: false,
    validateTasks: false,
  };
}

export function requirePermission(permission) {
  return async (req, res, next) => {
    const permissions = await getPermissionsFor(req.user.role);
    if (!permissions[permission]) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

export const PERMISSION_COLUMNS = COLUMN_TO_KEY;
