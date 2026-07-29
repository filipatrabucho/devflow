import { Router } from 'express';
import ExcelJS from 'exceljs';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../permissions.js';
import { uploadSpreadsheet } from '../middleware/upload.js';
import { DEVELOPMENT_PHASES, isValidDateString } from '../utils/validators.js';
import { fieldForHeader, mapPhase, cellText, parseFlexibleDate } from '../utils/excelImport.js';

const router = Router();

const TASK_FIELDS = `
  t.id, t.development_id AS "developmentId", t.title, t.description, t.phase,
  t.assigned_to AS "assignedTo", au.name AS "assignedToName", au.avatar_path AS "assignedToAvatar",
  t.validated_by AS "validatedBy", vu.name AS "validatedByName", t.validated_at AS "validatedAt",
  t.created_by AS "createdBy", cu.name AS "createdByName",
  t.created_at AS "createdAt", t.updated_at AS "updatedAt",
  (SELECT COUNT(*) FROM task_comments tc WHERE tc.task_id = t.id) AS "commentCount"
`;

const TASK_JOINS = `
  LEFT JOIN profiles au ON au.id = t.assigned_to
  LEFT JOIN profiles vu ON vu.id = t.validated_by
  LEFT JOIN profiles cu ON cu.id = t.created_by
`;

const DEV_FIELDS = `
  d.id, d.name, d.description, d.phase, d.start_date AS "startDate",
  d.questions, d.observations, d.requested_at AS "requestedAt",
  d.hours_estimate AS "hoursEstimate", d.completion_notes AS "completionNotes",
  d.created_at AS "createdAt", d.updated_at AS "updatedAt",
  d.created_by AS "createdBy", u.name AS "createdByName"
`;

router.get('/', requireAuth, async (_req, res) => {
  const [rows] = await pool.query(`
    SELECT ${DEV_FIELDS},
      (SELECT COUNT(*) FROM tasks t WHERE t.development_id = d.id) AS "taskCount"
    FROM developments d
    LEFT JOIN profiles u ON u.id = d.created_by
    ORDER BY d.created_at DESC
  `);
  res.json({ developments: rows });
});

router.get('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid development id' });

  const [rows] = await pool.execute(
    `SELECT ${DEV_FIELDS} FROM developments d LEFT JOIN profiles u ON u.id = d.created_by WHERE d.id = ?`,
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
    `SELECT ${DEV_FIELDS} FROM developments d LEFT JOIN profiles u ON u.id = d.created_by WHERE d.id = ?`,
    [result.insertId]
  );
  res.status(201).json({ development: rows[0] });
});

router.post('/import', requireAuth, requirePermission('manageDevelopments'), (req, res) => {
  uploadSpreadsheet.single('file')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Invalid file upload' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(req.file.buffer);
    } catch {
      return res.status(400).json({ error: 'Could not read the file as an Excel (.xlsx) workbook' });
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return res.status(400).json({ error: 'The workbook has no sheets' });
    }

    const headerRow = worksheet.getRow(1);
    const columnField = {};
    headerRow.eachCell((cell, colNumber) => {
      const field = fieldForHeader(cellText(cell.value));
      if (field) columnField[colNumber] = field;
    });

    if (!Object.values(columnField).includes('name')) {
      return res.status(400).json({ error: 'Could not find a "Tema" column in the first row' });
    }

    const created = [];
    const skipped = [];

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);
      if (row.cellCount === 0) continue;

      const fields = {};
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        const field = columnField[colNumber];
        if (field) fields[field] = cellText(cell.value);
      });

      const name = (fields.name || '').trim();
      if (!name) continue;
      if (name.length > 160) {
        skipped.push({ row: rowNumber, name, reason: 'Name (Tema) longer than 160 characters' });
        continue;
      }

      const warnings = [];
      let phase = 'waiting_list';
      if (fields.phaseRaw) {
        const mapped = mapPhase(fields.phaseRaw);
        if (mapped) {
          phase = mapped;
        } else {
          warnings.push(`Status "${fields.phaseRaw}" not recognized, defaulted to Waiting List`);
        }
      }

      let requestedAt = null;
      if (fields.requestedAt) {
        requestedAt = parseFlexibleDate(fields.requestedAt);
        if (!requestedAt) warnings.push(`Could not parse "Data Pedido" value "${fields.requestedAt}"`);
      }

      try {
        const [result] = await pool.execute(
          `INSERT INTO developments
             (name, description, phase, questions, observations, requested_at, hours_estimate, completion_notes, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            name,
            fields.description ? fields.description.trim() : null,
            phase,
            fields.questions ? fields.questions.trim() : null,
            fields.observations ? fields.observations.trim() : null,
            requestedAt,
            fields.hoursEstimate ? fields.hoursEstimate.trim().slice(0, 50) : null,
            fields.completionNotes ? fields.completionNotes.trim().slice(0, 500) : null,
            req.user.id,
          ]
        );
        created.push({ row: rowNumber, id: result.insertId, name, warnings });
      } catch {
        skipped.push({ row: rowNumber, name, reason: 'Could not save this row' });
      }
    }

    res.json({ createdCount: created.length, created, skipped });
  });
});

// Bulk-delete is intentionally restricted to the Senior/Admin roles
// specifically (not just anyone with "Manage developments", e.g. Partner),
// since it can wipe every task/comment underneath the selected developments.
router.post('/bulk-delete', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'senior') {
    return res.status(403).json({ error: 'Only Admin or Senior can bulk-delete developments' });
  }

  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids must be a non-empty array' });
  }
  if (ids.length > 500) {
    return res.status(400).json({ error: 'Cannot delete more than 500 developments at once' });
  }
  const cleanIds = ids.map(Number);
  if (cleanIds.some((n) => !Number.isInteger(n))) {
    return res.status(400).json({ error: 'All ids must be integers' });
  }

  const [result] = await pool.execute('DELETE FROM developments WHERE id = ANY(?::int[])', [cleanIds]);
  res.json({ deletedCount: result.affectedRows });
});

router.put('/:id', requireAuth, requirePermission('manageDevelopments'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid development id' });

  const {
    name,
    description,
    phase,
    startDate,
    questions,
    observations,
    requestedAt,
    hoursEstimate,
    completionNotes,
  } = req.body || {};
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
  if (requestedAt !== undefined && requestedAt !== null && requestedAt !== '' && !isValidDateString(requestedAt)) {
    return res.status(400).json({ error: 'Requested date must be a valid date' });
  }
  if (typeof hoursEstimate === 'string' && hoursEstimate.length > 50) {
    return res.status(400).json({ error: 'Hours estimate must be at most 50 characters' });
  }
  if (typeof completionNotes === 'string' && completionNotes.length > 500) {
    return res.status(400).json({ error: 'Completion notes must be at most 500 characters' });
  }

  await pool.execute(
    `UPDATE developments SET name = ?, description = ?, phase = ?, start_date = ?,
       questions = ?, observations = ?, requested_at = ?, hours_estimate = ?, completion_notes = ?
     WHERE id = ?`,
    [
      name !== undefined ? name.trim() : existing.name,
      description !== undefined ? String(description).trim() : existing.description,
      phase !== undefined ? phase : existing.phase,
      startDate !== undefined ? startDate || null : existing.start_date,
      questions !== undefined ? String(questions).trim() || null : existing.questions,
      observations !== undefined ? String(observations).trim() || null : existing.observations,
      requestedAt !== undefined ? requestedAt || null : existing.requested_at,
      hoursEstimate !== undefined ? String(hoursEstimate).trim() || null : existing.hours_estimate,
      completionNotes !== undefined ? String(completionNotes).trim() || null : existing.completion_notes,
      id,
    ]
  );

  const [rows] = await pool.execute(
    `SELECT ${DEV_FIELDS} FROM developments d LEFT JOIN profiles u ON u.id = d.created_by WHERE d.id = ?`,
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
    assigneeId = assignedTo;
    const [userRows] = await pool.execute('SELECT id FROM profiles WHERE id = ?', [assigneeId]);
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
