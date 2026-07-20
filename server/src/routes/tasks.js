import { Router } from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission, getPermissionsFor } from '../permissions.js';
import { TASK_FIELDS, TASK_JOINS } from './developments.js';
import { TASK_PHASES } from '../utils/validators.js';

const router = Router();

const DEVELOPER_ALLOWED_PHASES = new Set(['not_started', 'in_progress', 'in_validation']);
const VALIDATED_PHASES = new Set(['approved', 'done']);

router.get('/', requireAuth, requirePermission('viewAllTasks'), async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT ${TASK_FIELDS}, d.name AS developmentName FROM tasks t
     ${TASK_JOINS}
     LEFT JOIN developments d ON d.id = t.development_id
     ORDER BY t.updated_at DESC`
  );
  res.json({ tasks: rows });
});

router.get('/mine', requireAuth, async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT ${TASK_FIELDS}, d.name AS developmentName FROM tasks t
     ${TASK_JOINS}
     LEFT JOIN developments d ON d.id = t.development_id
     WHERE t.assigned_to = ?
     ORDER BY t.updated_at DESC`,
    [req.user.id]
  );
  res.json({ tasks: rows });
});

router.put('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid task id' });

  const [rows] = await pool.execute('SELECT * FROM tasks WHERE id = ?', [id]);
  const task = rows[0];
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const permissions = await getPermissionsFor(req.user.role);
  const canManage = permissions.manageTasks;
  const isAssignee = task.assigned_to === req.user.id;
  if (!canManage && !isAssignee) {
    return res.status(403).json({ error: 'You can only update tasks assigned to you' });
  }

  const { title, description, assignedTo, phase } = req.body || {};
  let {
    title: nextTitle,
    description: nextDescription,
    assigned_to: nextAssignee,
    phase: nextPhase,
    validated_by: nextValidatedBy,
    validated_at: nextValidatedAt,
  } = task;

  if (canManage) {
    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim().length < 2) {
        return res.status(400).json({ error: 'Title must be at least 2 characters' });
      }
      nextTitle = title.trim();
    }
    if (description !== undefined) {
      nextDescription = description ? String(description).trim() : null;
    }
    if (assignedTo !== undefined) {
      if (assignedTo === null || assignedTo === '') {
        nextAssignee = null;
      } else {
        const assigneeId = Number(assignedTo);
        const [userRows] = await pool.execute('SELECT id FROM users WHERE id = ?', [assigneeId]);
        if (!userRows[0]) return res.status(400).json({ error: 'Assigned user does not exist' });
        nextAssignee = assigneeId;
      }
    }
  } else if (assignedTo !== undefined || title !== undefined || description !== undefined) {
    return res.status(403).json({ error: 'Only a manager can edit task details or reassign' });
  }

  if (phase !== undefined) {
    if (!TASK_PHASES.includes(phase)) {
      return res.status(400).json({ error: 'Invalid phase' });
    }
    if (!canManage && !DEVELOPER_ALLOWED_PHASES.has(phase)) {
      return res.status(403).json({ error: 'Only a manager can approve or complete a task' });
    }
    nextPhase = phase;

    if (VALIDATED_PHASES.has(phase) && !VALIDATED_PHASES.has(task.phase)) {
      nextValidatedBy = req.user.id;
      nextValidatedAt = new Date();
    } else if (!VALIDATED_PHASES.has(phase)) {
      nextValidatedBy = null;
      nextValidatedAt = null;
    }
  }

  await pool.execute(
    `UPDATE tasks SET title = ?, description = ?, assigned_to = ?, phase = ?,
       validated_by = ?, validated_at = ? WHERE id = ?`,
    [nextTitle, nextDescription, nextAssignee, nextPhase, nextValidatedBy, nextValidatedAt, id]
  );

  const [updatedRows] = await pool.execute(
    `SELECT ${TASK_FIELDS} FROM tasks t ${TASK_JOINS} WHERE t.id = ?`,
    [id]
  );
  res.json({ task: updatedRows[0] });
});

router.delete('/:id', requireAuth, requirePermission('manageTasks'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid task id' });

  const [result] = await pool.execute('DELETE FROM tasks WHERE id = ?', [id]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Task not found' });
  res.status(204).end();
});

export default router;
