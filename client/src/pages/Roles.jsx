import { useEffect, useState } from 'react';
import { api } from '../api/client';

const PERMISSION_COLUMNS = [
  { key: 'manageUsers', label: 'Manage users' },
  { key: 'manageDevelopments', label: 'Manage developments' },
  { key: 'manageTasks', label: 'Manage tasks' },
  { key: 'viewAllTasks', label: 'View all tasks' },
];

export default function Roles() {
  const [roles, setRoles] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [savingKey, setSavingKey] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get('/roles');
      setRoles(data.roles);
      setDrafts(Object.fromEntries(data.roles.map((r) => [r.key, { label: r.label, ...r.permissions }])));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function updateDraft(key, patch) {
    setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  async function handleSave(key) {
    setError('');
    setSuccess('');
    setSavingKey(key);
    const draft = drafts[key];
    try {
      await api.put(`/roles/${key}`, draft);
      setSuccess(`${draft.label} updated.`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingKey(null);
    }
  }

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Roles</h1>
          <p className="muted">Rename roles and choose what each one can access.</p>
        </div>
      </div>

      {error && <div className="alert alert--error">{error}</div>}
      {success && <div className="alert alert--success">{success}</div>}

      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Label</th>
              {PERMISSION_COLUMNS.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => {
              const draft = drafts[role.key] || {};
              return (
                <tr key={role.key}>
                  <td>
                    <input
                      type="text"
                      value={draft.label ?? ''}
                      onChange={(e) => updateDraft(role.key, { label: e.target.value })}
                      maxLength={100}
                    />
                  </td>
                  {PERMISSION_COLUMNS.map((col) => (
                    <td key={col.key}>
                      <input
                        type="checkbox"
                        checked={!!draft[col.key]}
                        onChange={(e) => updateDraft(role.key, { [col.key]: e.target.checked })}
                      />
                    </td>
                  ))}
                  <td>
                    <button
                      className="btn btn--secondary"
                      onClick={() => handleSave(role.key)}
                      disabled={savingKey === role.key}
                    >
                      {savingKey === role.key ? 'Saving...' : 'Save'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
