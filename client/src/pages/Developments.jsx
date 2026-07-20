import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { DEVELOPMENT_PHASES } from '../constants';
import PhaseBadge from '../components/PhaseBadge';

export default function Developments() {
  const { can } = useAuth();
  const [developments, setDevelopments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', phase: 'waiting_list', startDate: '' });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get('/developments');
      setDevelopments(data.developments);
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
    setSaving(true);
    setError('');
    try {
      await api.post('/developments', form);
      setForm({ name: '', description: '', phase: 'waiting_list', startDate: '' });
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Developments</h1>
        {can('manageDevelopments') && (
          <button className="btn btn--primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : 'New Development'}
          </button>
        )}
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {showForm && (
        <form className="card form" onSubmit={handleCreate}>
          <label className="field">
            <span>Name</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              minLength={2}
              maxLength={160}
            />
          </label>
          <label className="field">
            <span>Description</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
            />
          </label>
          <label className="field">
            <span>Phase</span>
            <select value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value })}>
              {DEVELOPMENT_PHASES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Start date</span>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </label>
          <button className="btn btn--primary" type="submit" disabled={saving}>
            {saving ? 'Creating...' : 'Create development'}
          </button>
        </form>
      )}

      {loading ? (
        <p>Loading...</p>
      ) : developments.length === 0 ? (
        <div className="empty-state">No developments yet.</div>
      ) : (
        <div className="grid">
          {developments.map((dev) => (
            <Link to={`/developments/${dev.id}`} key={dev.id} className="card card--link">
              <div className="card__header">
                <h3>{dev.name}</h3>
                <PhaseBadge phase={dev.phase} list={DEVELOPMENT_PHASES} />
              </div>
              {dev.description && <p className="card__description">{dev.description}</p>}
              <div className="card__dates">
                <span>Created {new Date(dev.createdAt).toLocaleDateString()}</span>
                {dev.startDate && <span>Started {new Date(dev.startDate).toLocaleDateString()}</span>}
              </div>
              <div className="card__footer">
                <span>{dev.taskCount} task(s)</span>
                {dev.createdByName && <span>by {dev.createdByName}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
