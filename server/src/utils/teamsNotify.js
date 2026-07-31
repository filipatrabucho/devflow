import pool from '../db.js';

async function getTeamsWebhookUrl() {
  const [rows] = await pool.query('SELECT teams_webhook_url AS "url" FROM integration_settings WHERE id = 1');
  return rows[0]?.url || null;
}

// Posts a Microsoft Teams Incoming Webhook "MessageCard". Never throws — a
// Teams outage or a stale webhook URL must not break the development/task
// action that triggered this notification, so every failure is swallowed
// here and reported back only as `{ sent: false, reason }` for callers (like
// the integrations "send test message" button) that actually want to know.
//
// This is awaited at every call site rather than fired-and-forgotten,
// because this app runs as a Netlify Function (see server/src/lambda.js):
// once the handler's response is sent, the execution environment can freeze
// immediately, and an un-awaited fetch() in flight would likely never
// complete.
export async function notifyTeams(title, text, { color = '552F86' } = {}) {
  let url;
  try {
    url = await getTeamsWebhookUrl();
  } catch (err) {
    console.error('Could not read the Teams webhook URL:', err.message);
    return { sent: false, reason: err.message };
  }
  if (!url) return { sent: false, reason: 'not_configured' };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        '@type': 'MessageCard',
        '@context': 'http://schema.org/extensions',
        summary: title,
        themeColor: color,
        title,
        text,
      }),
    });
    if (!res.ok) {
      const reason = `Teams responded with ${res.status}`;
      console.error('Teams notification failed:', reason);
      return { sent: false, reason };
    }
    return { sent: true };
  } catch (err) {
    console.error('Teams notification failed:', err.message);
    return { sent: false, reason: err.message };
  }
}
