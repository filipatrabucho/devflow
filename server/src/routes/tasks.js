import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { TASK_FIELDS } from './developments.js';
import { TASK_PHASES } from '../utils/validators.js';

const router = Router();

const DEVELOPER_ALLOWED_PHASES = new Set(['not_started', 'in_progress', 'in_validation']);

router.get('/mine', requireAuth, async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT ${TASK_FIELDS}, d.name AS developmentName FROM tasks t
     LEFT JOIN users au ON au.id = t.assigned_to
     LEFT JOIN users cu ON cu.id = t.created_by
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

  const isSenior = req.user.role === 'senior';
  const isAssignee = task.assigned_to === req.user.id;
  if (!isSenior && !isAssignee) {
    return res.status(403).json({ error: 'You can only update tasks assigned to you' });
  }

  const { title, description, assignedTo, phase } = req.body || {};
  let { title: nextTitle, description: nextDescription, assigned_to: nextAssignee, phase: nextPhase } = task;

  if (isSenior) {
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
    return res.status(403).json({ error: 'Only a senior can edit task details or reassign' });
  }

  if (phase !== undefined) {
    if (!TASK_PHASES.includes(phase)) {
      return res.status(400).json({ error: 'Invalid phase' });
    }
    if (!isSenior && !DEVELOPER_ALLOWED_PHASES.has(phase)) {
      return res.status(403).json({ error: 'Only a senior can approve or complete a task' });
    }
    nextPhase = phase;
  }

  await pool.execute(
    'UPDATE tasks SET title = ?, description = ?, assigned_to = ?, phase = ? WHERE id = ?',
    [nextTitle, nextDescription, nextAssignee, nextPhase, id]
  );

  const [updatedRows] = await pool.execute(
    `SELECT ${TASK_FIELDS} FROM tasks t
     LEFT JOIN users au ON au.id = t.assigned_to
     LEFT JOIN users cu ON cu.id = t.created_by
     WHERE t.id = ?`,
    [id]
  );
  res.json({ task: updatedRows[0] });
});

router.delete('/:id', requireAuth, requireRole('senior'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid task id' });

  const [result] = await pool.execute('DELETE FROM tasks WHERE id = ?', [id]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Task not found' });
  res.status(204).end();
});

export default router;
