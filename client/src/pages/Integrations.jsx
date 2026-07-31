import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function Integrations() {
  const [teamsWebhookUrl, setTeamsWebhookUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await api.get('/integrations');
      setTeamsWebhookUrl(data.integrations?.teamsWebhookUrl || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const data = await api.put('/integrations', { teamsWebhookUrl: teamsWebhookUrl.trim() || null });
      setTeamsWebhookUrl(data.integrations?.teamsWebhookUrl || '');
      setSuccess('Integration settings saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setError('');
    setSuccess('');
    try {
      await api.post('/integrations/teams/test');
      setSuccess('Test message sent — check your Teams channel.');
    } catch (err) {
      setError(err.message);
    } finally {
      setTesting(false);
    }
  }

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Integrations</h1>
          <p className="muted">Connect DevFlow to the tools your team already uses.</p>
        </div>
      </div>

      {error && <div className="alert alert--error">{error}</div>}
      {success && <div className="alert alert--success">{success}</div>}

      <form className="card form" onSubmit={handleSave}>
        <h3>Microsoft Teams</h3>
        <p className="muted" style={{ marginBottom: 14 }}>
          Get a new development, a new task, or a phase change posted straight into a Teams channel. Create an{' '}
          <strong>Incoming Webhook</strong> connector on that channel and paste its URL below.
        </p>
        <label className="field">
          <span>Teams webhook URL</span>
          <input
            type="url"
            value={teamsWebhookUrl}
            onChange={(e) => setTeamsWebhookUrl(e.target.value)}
            placeholder="https://outlook.office.com/webhook/..."
          />
        </label>
        <div className="table__actions">
          <button className="btn btn--primary" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button className="btn btn--secondary" type="button" onClick={handleTest} disabled={testing}>
            {testing ? 'Sending...' : 'Send test message'}
          </button>
        </div>
      </form>
    </div>
  );
}
