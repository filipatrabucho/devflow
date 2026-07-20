import { useEffect, useState } from 'react';
import { api } from '../api/client';
import Avatar from '../components/Avatar';

const emptyForm = { name: '', email: '', password: '', role: 'developer' };

export default function Users() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [userData, roleData] = await Promise.all([api.get('/users'), api.get('/roles')]);
      setUsers(userData.users);
      setRoles(roleData.roles);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.email.toLowerCase().endsWith('@pkf.pt')) {
      setError('Email must be a @pkf.pt address.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setSaving(true);
    try {
      await api.post('/users', form);
      setForm(emptyForm);
      setShowForm(false);
      setSuccess('User created successfully.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Remove this user?')) return;
    setError('');
    try {
      await api.delete(`/users/${id}`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRoleChange(id, role) {
    setError('');
    setUpdatingId(id);
    try {
      const data = await api.put(`/users/${id}`, { role });
      setUsers((prev) => prev.map((u) => (u.id === id ? data.user : u)));
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Users</h1>
        <button className="btn btn--primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : 'New User'}
        </button>
      </div>

      {error && <div className="alert alert--error">{error}</div>}
      {success && <div className="alert alert--success">{success}</div>}

      {showForm && (
        <form className="card form" onSubmit={handleCreate}>
          <label className="field">
            <span>Full name</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              minLength={2}
              maxLength={120}
            />
          </label>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="name@pkf.pt"
              required
            />
          </label>
          <label className="field">
            <span>Temporary password</span>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              minLength={8}
              required
            />
          </label>
          <label className="field">
            <span>Role</span>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {roles.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn--primary" type="submit" disabled={saving}>
            {saving ? 'Creating...' : 'Create user'}
          </button>
        </form>
      )}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th></th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <Avatar name={u.name} src={u.avatarPath} size={32} />
                </td>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <select
                    value={u.role}
                    disabled={updatingId === u.id}
                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                  >
                    {roles.map((r) => (
                      <option key={r.key} value={r.key}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <button className="btn btn--ghost btn--danger" onClick={() => handleDelete(u.id)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
