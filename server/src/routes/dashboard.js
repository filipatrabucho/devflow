import { Router } from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { getPermissionsFor } from '../permissions.js';
import { TASK_PHASES } from '../utils/validators.js';

const router = Router();

function phaseCountMap(rows) {
  const map = Object.fromEntries(TASK_PHASES.map((p) => [p, 0]));
  for (const row of rows) {
    if (row.phase in map) map[row.phase] = Number(row.count);
  }
  return map;
}

router.get('/', requireAuth, async (req, res) => {
  const [myRows] = await pool.execute(
    'SELECT phase, COUNT(*) AS count FROM tasks WHERE assigned_to = ? GROUP BY phase',
    [req.user.id]
  );
  const myTasksByPhase = phaseCountMap(myRows);
  const myPendingTasks = Object.entries(myTasksByPhase).reduce(
    (sum, [phase, count]) => (phase === 'done' ? sum : sum + count),
    0
  );

  const permissions = await getPermissionsFor(req.user.role);

  let pendingValidationCount = null;
  if (permissions.validateTasks) {
    const [[{ count }]] = await pool.query("SELECT COUNT(*) AS count FROM tasks WHERE phase = 'in_validation'");
    pendingValidationCount = Number(count);
  }

  // Permission-based rather than a literal role-name check, so a custom role
  // created from the Roles page with every permission granted also gets the
  // full oversight section below, not just the built-in "admin"/"senior" keys.
  const isTopLevel =
    permissions.manageUsers &&
    permissions.manageDevelopments &&
    permissions.manageTasks &&
    permissions.viewAllTasks &&
    permissions.validateTasks;
  let overview = null;

  if (isTopLevel) {
    const [[{ count: developmentsAwaitingResponse }]] = await pool.query(
      "SELECT COUNT(*) AS count FROM developments WHERE phase IN ('waiting_list', 'in_search')"
    );

    const [[{ count: developmentsInProgressPending }]] = await pool.query(`
      SELECT COUNT(*) AS count FROM developments d
      WHERE d.phase IN ('in_development', 'in_production')
        AND EXISTS (SELECT 1 FROM tasks t WHERE t.development_id = d.id AND t.phase != 'done')
    `);

    const [teamRows] = await pool.query('SELECT phase, COUNT(*) AS count FROM tasks GROUP BY phase');

    const [staffWithoutTasks] = await pool.query(`
      SELECT p.id, p.name, r.label AS "roleLabel" FROM profiles p
      JOIN roles r ON r.key_name = p.role
      WHERE r.is_staff = TRUE
        AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.assigned_to = p.id AND t.phase != 'done')
      ORDER BY p.name ASC
    `);

    overview = {
      developmentsAwaitingResponse: Number(developmentsAwaitingResponse),
      developmentsInProgressPending: Number(developmentsInProgressPending),
      tasksByPhase: phaseCountMap(teamRows),
      staffWithoutTasks,
    };
  }

  res.json({
    myTasksByPhase,
    myPendingTasks,
    pendingValidationCount,
    overview,
  });
});

export default router;
