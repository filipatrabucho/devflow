import { Router } from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission, getRoles, invalidateRoleCache } from '../permissions.js';

const router = Router();

router.get('/', requireAuth, async (_req, res) => {
  const roles = await getRoles();
  res.json({ roles });
});

router.put('/:key', requireAuth, requirePermission('manageUsers'), async (req, res) => {
  const { key } = req.params;
  const { label, manageUsers, manageDevelopments, manageTasks, viewAllTasks } = req.body || {};

  const [existingRows] = await pool.execute('SELECT * FROM roles WHERE key_name = ?', [key]);
  const existing = existingRows[0];
  if (!existing) return res.status(404).json({ error: 'Role not found' });

  if (label !== undefined && (typeof label !== 'string' || label.trim().length < 2 || label.trim().length > 100)) {
    return res.status(400).json({ error: 'Label must be between 2 and 100 characters' });
  }

  const next = {
    label: label !== undefined ? label.trim() : existing.label,
    can_manage_users: manageUsers !== undefined ? !!manageUsers : !!existing.can_manage_users,
    can_manage_developments:
      manageDevelopments !== undefined ? !!manageDevelopments : !!existing.can_manage_developments,
    can_manage_tasks: manageTasks !== undefined ? !!manageTasks : !!existing.can_manage_tasks,
    can_view_all_tasks: viewAllTasks !== undefined ? !!viewAllTasks : !!existing.can_view_all_tasks,
  };

  if (!next.can_manage_users) {
    const [allRoles] = await pool.query('SELECT key_name, can_manage_users FROM roles');
    const stillHasManager = allRoles.some((r) =>
      r.key_name === key ? next.can_manage_users : !!r.can_manage_users
    );
    if (!stillHasManager) {
      return res.status(400).json({ error: 'At least one role must be able to manage users' });
    }
  }

  await pool.execute(
    `UPDATE roles SET label = ?, can_manage_users = ?, can_manage_developments = ?,
       can_manage_tasks = ?, can_view_all_tasks = ? WHERE key_name = ?`,
    [
      next.label,
      next.can_manage_users,
      next.can_manage_developments,
      next.can_manage_tasks,
      next.can_view_all_tasks,
      key,
    ]
  );

  invalidateRoleCache();
  const roles = await getRoles();
  res.json({ role: roles.find((r) => r.key === key) });
});

export default router;
