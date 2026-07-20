import { Router } from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission, getPermissionsFor } from '../permissions.js';
import { TASK_FIELDS, TASK_JOINS } from './developments.js';
import { TASK_PHASES } from '../utils/validators.js';

const router = Router();

const DEVELOPER_ALLOWED_PHASES = new Set(['not_started', 'in_progress', 'in_validation']);
const VALIDATED_PHASES = new Set(['approved', 'done']);

const COMMENT_FIELDS = `
  c.id, c.task_id AS taskId, c.body, c.is_system AS isSystem, c.event_type AS eventType,
  c.from_phase AS fromPhase, c.to_phase AS toPhase, c.created_at AS createdAt,
  c.author_id AS authorId, u.name AS authorName, u.avatar_path AS authorAvatar
`;

function classifyTransition(fromPhase, toPhase) {
  if (fromPhase === 'in_validation' && DEVELOPER_ALLOWED_PHASES.has(toPhase) && toPhase !== 'in_validation') {
    return 'rejected';
  }
  if (VALIDATED_PHASES.has(fromPhase) && !VALIDATED_PHASES.has(toPhase)) {
    return 'reopened';
  }
  if (!VALIDATED_PHASES.has(fromPhase) && toPhase === 'approved') {
    return 'approved';
  }
  if (fromPhase !== 'done' && toPhase === 'done') {
    return 'done';
  }
  return 'moved';
}

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

router.get('/pending-validation', requireAuth, requirePermission('validateTasks'), async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT ${TASK_FIELDS}, d.name AS developmentName FROM tasks t
     ${TASK_JOINS}
     LEFT JOIN developments d ON d.id = t.development_id
     WHERE t.phase = 'in_validation'
     ORDER BY t.updated_at ASC`
  );
  res.json({ tasks: rows });
});

router.get('/:id/comments', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid task id' });

  const [rows] = await pool.execute(
    `SELECT ${COMMENT_FIELDS} FROM task_comments c
     LEFT JOIN users u ON u.id = c.author_id
     WHERE c.task_id = ? ORDER BY c.created_at ASC`,
    [id]
  );
  res.json({ comments: rows });
});

router.post('/:id/comments', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid task id' });

  const { body } = req.body || {};
  if (typeof body !== 'string' || body.trim().length < 1 || body.trim().length > 2000) {
    return res.status(400).json({ error: 'Comment must be between 1 and 2000 characters' });
  }

  const [taskRows] = await pool.execute('SELECT id FROM tasks WHERE id = ?', [id]);
  if (!taskRows[0]) return res.status(404).json({ error: 'Task not found' });

  const [result] = await pool.execute(
    'INSERT INTO task_comments (task_id, author_id, body, is_system) VALUES (?, ?, ?, 0)',
    [id, req.user.id, body.trim()]
  );

  const [rows] = await pool.execute(
    `SELECT ${COMMENT_FIELDS} FROM task_comments c LEFT JOIN users u ON u.id = c.author_id WHERE c.id = ?`,
    [result.insertId]
  );
  res.status(201).json({ comment: rows[0] });
});

router.put('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid task id' });

  const [rows] = await pool.execute('SELECT * FROM tasks WHERE id = ?', [id]);
  const task = rows[0];
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const permissions = await getPermissionsFor(req.user.role);
  const canManage = permissions.manageTasks;
  const canValidate = permissions.validateTasks;
  const isAssignee = task.assigned_to === req.user.id;
  if (!canManage && !canValidate && !isAssignee) {
    return res.status(403).json({ error: 'You can only update tasks assigned to you' });
  }

  const { title, description, assignedTo, phase, comment } = req.body || {};
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

  let phaseChanged = false;
  if (phase !== undefined) {
    if (!TASK_PHASES.includes(phase)) {
      return res.status(400).json({ error: 'Invalid phase' });
    }
    if (!canManage && !canValidate && !DEVELOPER_ALLOWED_PHASES.has(phase)) {
      return res.status(403).json({ error: 'Only a manager or validator can approve or complete a task' });
    }
    phaseChanged = phase !== task.phase;
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

  if (phaseChanged) {
    const eventType = classifyTransition(task.phase, nextPhase);
    const noteBody = comment && String(comment).trim() ? String(comment).trim() : '';
    await pool.execute(
      `INSERT INTO task_comments (task_id, author_id, body, is_system, event_type, from_phase, to_phase)
       VALUES (?, ?, ?, 1, ?, ?, ?)`,
      [id, req.user.id, noteBody, eventType, task.phase, nextPhase]
    );
  }

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
