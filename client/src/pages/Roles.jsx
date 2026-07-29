import { useEffect, useState } from 'react';
import { api } from '../api/client';

const PERMISSION_COLUMNS = [
  { key: 'manageUsers', label: 'Manage users' },
  { key: 'manageDevelopments', label: 'Manage developments' },
  { key: 'manageTasks', label: 'Manage tasks' },
  { key: 'viewAllTasks', label: 'View all tasks' },
  { key: 'validateTasks', label: 'Validate tasks' },
];

const emptyNewRole = {
  key: '',
  label: '',
  manageUsers: false,
  manageDevelopments: false,
  manageTasks: false,
  viewAllTasks: false,
  validateTasks: false,
  isStaff: false,
};

export default function Roles() {
  const [roles, setRoles] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [savingKey, setSavingKey] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [newRole, setNewRole] = useState(emptyNewRole);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get('/roles');
      setRoles(data.roles);
      setDrafts(
        Object.fromEntries(
          data.roles.map((r) => [r.key, { label: r.label, isStaff: r.isStaff, ...r.permissions }])
        )
      );
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

  async function handleDelete(key) {
    if (!window.confirm(`Delete the "${key}" role? This cannot be undone.`)) return;
    setError('');
    setSuccess('');
    try {
      await api.delete(`/roles/${key}`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setCreating(true);
    try {
      await api.post('/roles', newRole);
      setNewRole(emptyNewRole);
      setShowForm(false);
      setSuccess('Role created.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Roles</h1>
          <p className="muted">Rename roles, choose what each one can access, or add a new one.</p>
        </div>
        <button className="btn btn--primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : 'New Role'}
        </button>
      </div>

      {error && <div className="alert alert--error">{error}</div>}
      {success && <div className="alert alert--success">{success}</div>}

      {showForm && (
        <form className="card form" onSubmit={handleCreate}>
          <label className="field">
            <span>Key (internal, permanent)</span>
            <input
              value={newRole.key}
              onChange={(e) => setNewRole({ ...newRole, key: e.target.value.toLowerCase() })}
              placeholder="e.g. lead"
              pattern="[a-z][a-z0-9_]{1,29}"
              title="2-30 lowercase letters, numbers or underscores, starting with a letter"
              required
            />
          </label>
          <label className="field">
            <span>Label</span>
            <input
              value={newRole.label}
              onChange={(e) => setNewRole({ ...newRole, label: e.target.value })}
              maxLength={100}
              required
            />
          </label>
          {PERMISSION_COLUMNS.map((col) => (
            <label className="field field--inline" key={col.key}>
              <input
                type="checkbox"
                checked={newRole[col.key]}
                onChange={(e) => setNewRole({ ...newRole, [col.key]: e.target.checked })}
              />
              <span>{col.label}</span>
            </label>
          ))}
          <label className="field field--inline">
            <input
              type="checkbox"
              checked={newRole.isStaff}
              onChange={(e) => setNewRole({ ...newRole, isStaff: e.target.checked })}
            />
            <span>Counts as staff (Dashboard)</span>
          </label>
          <button className="btn btn--primary" type="submit" disabled={creating}>
            {creating ? 'Creating...' : 'Create role'}
          </button>
        </form>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Label</th>
              {PERMISSION_COLUMNS.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
              <th>Counts as staff (Dashboard)</th>
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
                    <input
                      type="checkbox"
                      checked={!!draft.isStaff}
                      onChange={(e) => updateDraft(role.key, { isStaff: e.target.checked })}
                    />
                  </td>
                  <td className="table__actions">
                    <button
                      className="btn btn--secondary"
                      onClick={() => handleSave(role.key)}
                      disabled={savingKey === role.key}
                    >
                      {savingKey === role.key ? 'Saving...' : 'Save'}
                    </button>
                    <button className="btn btn--ghost btn--danger" onClick={() => handleDelete(role.key)}>
                      Delete
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
