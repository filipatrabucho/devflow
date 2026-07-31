import { Router } from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { notifyTeams } from '../utils/teamsNotify.js';

const router = Router();

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only Admin can view or edit integration settings' });
  }
  next();
}

router.get('/', requireAuth, requireAdmin, async (_req, res) => {
  const [rows] = await pool.query(
    'SELECT teams_webhook_url AS "teamsWebhookUrl" FROM integration_settings WHERE id = 1'
  );
  res.json({ integrations: rows[0] || { teamsWebhookUrl: null } });
});

router.put('/', requireAuth, requireAdmin, async (req, res) => {
  const { teamsWebhookUrl } = req.body || {};

  let finalUrl = null;
  if (teamsWebhookUrl !== null && teamsWebhookUrl !== undefined && teamsWebhookUrl !== '') {
    if (typeof teamsWebhookUrl !== 'string' || !/^https:\/\//i.test(teamsWebhookUrl.trim())) {
      return res.status(400).json({ error: 'Teams webhook URL must be a valid https:// URL' });
    }
    finalUrl = teamsWebhookUrl.trim();
  }

  await pool.execute('UPDATE integration_settings SET teams_webhook_url = ? WHERE id = 1', [finalUrl]);
  res.json({ integrations: { teamsWebhookUrl: finalUrl } });
});

router.post('/teams/test', requireAuth, requireAdmin, async (_req, res) => {
  const result = await notifyTeams(
    'DevFlow test message',
    'If you can see this in Teams, development and task updates will be posted here too.'
  );
  if (!result.sent) {
    const message =
      result.reason === 'not_configured'
        ? 'Set a Teams webhook URL first, then save before sending a test message.'
        : `Could not reach Teams: ${result.reason}`;
    return res.status(400).json({ error: message });
  }
  res.json({ ok: true });
});

export default router;
