import { Router } from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../permissions.js';
import { DEVELOPMENT_PHASES, isValidDateString } from '../utils/validators.js';

const router = Router();

const TASK_FIELDS = `
  t.id, t.development_id AS developmentId, t.title, t.description, t.phase,
  t.assigned_to AS assignedTo, au.name AS assignedToName, au.avatar_path AS assignedToAvatar,
  t.validated_by AS validatedBy, vu.name AS validatedByName, t.validated_at AS validatedAt,
  t.created_by AS createdBy, cu.name AS createdByName,
  t.created_at AS createdAt, t.updated_at AS updatedAt
`;

const TASK_JOINS = `
  LEFT JOIN users au ON au.id = t.assigned_to
  LEFT JOIN users vu ON vu.id = t.validated_by
  LEFT JOIN users cu ON cu.id = t.created_by
`;

const DEV_FIELDS = `
  d.id, d.name, d.description, d.phase, d.start_date AS startDate,
  d.created_at AS createdAt, d.updated_at AS updatedAt,
  d.created_by AS createdBy, u.name AS createdByName
`;

router.get('/', requireAuth, async (_req, res) => {
  const [rows] = await pool.query(`
    SELECT ${DEV_FIELDS},
      (SELECT COUNT(*) FROM tasks t WHERE t.development_id = d.id) AS taskCount
    FROM developments d
    LEFT JOIN users u ON u.id = d.created_by
    ORDER BY d.created_at DESC
  `);
  res.json({ developments: rows });
});

router.get('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid development id' });

  const [rows] = await pool.execute(
    `SELECT ${DEV_FIELDS} FROM developments d LEFT JOIN users u ON u.id = d.created_by WHERE d.id = ?`,
    [id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Development not found' });
  res.json({ development: rows[0] });
});

router.post('/', requireAuth, requirePermission('manageDevelopments'), async (req, res) => {
  const { name, description, phase, startDate } = req.body || {};

  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 160) {
    return res.status(400).json({ error: 'Name must be between 2 and 160 characters' });
  }
  if (startDate && !isValidDateString(startDate)) {
    return res.status(400).json({ error: 'Start date must be a valid date' });
  }
  const finalPhase = DEVELOPMENT_PHASES.includes(phase) ? phase : 'waiting_list';

  const [result] = await pool.execute(
    'INSERT INTO developments (name, description, phase, start_date, created_by) VALUES (?, ?, ?, ?, ?)',
    [name.trim(), description ? String(description).trim() : null, finalPhase, startDate || null, req.user.id]
  );

  const [rows] = await pool.execute(
    `SELECT ${DEV_FIELDS} FROM developments d LEFT JOIN users u ON u.id = d.created_by WHERE d.id = ?`,
    [result.insertId]
  );
  res.status(201).json({ development: rows[0] });
});

router.put('/:id', requireAuth, requirePermission('manageDevelopments'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid development id' });

  const { name, description, phase, startDate } = req.body || {};
  const [existingRows] = await pool.execute('SELECT * FROM developments WHERE id = ?', [id]);
  const existing = existingRows[0];
  if (!existing) return res.status(404).json({ error: 'Development not found' });

  if (name !== undefined && (typeof name !== 'string' || name.trim().length < 2)) {
    return res.status(400).json({ error: 'Name must be at least 2 characters' });
  }
  if (phase !== undefined && !DEVELOPMENT_PHASES.includes(phase)) {
    return res.status(400).json({ error: 'Invalid phase' });
  }
  if (startDate !== undefined && startDate !== null && startDate !== '' && !isValidDateString(startDate)) {
    return res.status(400).json({ error: 'Start date must be a valid date' });
  }

  await pool.execute(
    'UPDATE developments SET name = ?, description = ?, phase = ?, start_date = ? WHERE id = ?',
    [
      name !== undefined ? name.trim() : existing.name,
      description !== undefined ? String(description).trim() : existing.description,
      phase !== undefined ? phase : existing.phase,
      startDate !== undefined ? startDate || null : existing.start_date,
      id,
    ]
  );

  const [rows] = await pool.execute(
    `SELECT ${DEV_FIELDS} FROM developments d LEFT JOIN users u ON u.id = d.created_by WHERE d.id = ?`,
    [id]
  );
  res.json({ development: rows[0] });
});

router.delete('/:id', requireAuth, requirePermission('manageDevelopments'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid development id' });

  const [result] = await pool.execute('DELETE FROM developments WHERE id = ?', [id]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Development not found' });
  res.status(204).end();
});

router.get('/:id/tasks', requireAuth, async (req, res) => {
  const developmentId = Number(req.params.id);
  if (!Number.isInteger(developmentId)) return res.status(400).json({ error: 'Invalid development id' });

  const [rows] = await pool.execute(
    `SELECT ${TASK_FIELDS} FROM tasks t
     ${TASK_JOINS}
     WHERE t.development_id = ?
     ORDER BY t.created_at ASC`,
    [developmentId]
  );
  res.json({ tasks: rows });
});

router.post('/:id/tasks', requireAuth, requirePermission('manageTasks'), async (req, res) => {
  const developmentId = Number(req.params.id);
  if (!Number.isInteger(developmentId)) return res.status(400).json({ error: 'Invalid development id' });

  const { title, description, assignedTo } = req.body || {};
  if (typeof title !== 'string' || title.trim().length < 2 || title.trim().length > 200) {
    return res.status(400).json({ error: 'Title must be between 2 and 200 characters' });
  }

  const [devRows] = await pool.execute('SELECT id FROM developments WHERE id = ?', [developmentId]);
  if (!devRows[0]) return res.status(404).json({ error: 'Development not found' });

  let assigneeId = null;
  if (assignedTo !== undefined && assignedTo !== null && assignedTo !== '') {
    assigneeId = Number(assignedTo);
    const [userRows] = await pool.execute('SELECT id FROM users WHERE id = ?', [assigneeId]);
    if (!userRows[0]) return res.status(400).json({ error: 'Assigned user does not exist' });
  }

  const [result] = await pool.execute(
    'INSERT INTO tasks (development_id, title, description, assigned_to, created_by) VALUES (?, ?, ?, ?, ?)',
    [developmentId, title.trim(), description ? String(description).trim() : null, assigneeId, req.user.id]
  );

  const [rows] = await pool.execute(
    `SELECT ${TASK_FIELDS} FROM tasks t ${TASK_JOINS} WHERE t.id = ?`,
    [result.insertId]
  );
  res.status(201).json({ task: rows[0] });
});

export default router;
export { TASK_FIELDS, TASK_JOINS };
