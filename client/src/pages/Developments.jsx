import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { DEVELOPMENT_PHASES } from '../constants';
import PhaseBadge from '../components/PhaseBadge';
import Modal from '../components/Modal';

const EMPTY_FORM = { name: '', description: '', phase: 'waiting_list', startDate: '' };

export default function Developments() {
  const { can } = useAuth();
  const [developments, setDevelopments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState('list');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [requestedFrom, setRequestedFrom] = useState('');
  const [requestedTo, setRequestedTo] = useState('');

  const importInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

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

  const filteredDevelopments = useMemo(() => {
    const term = search.trim().toLowerCase();
    return developments.filter((dev) => {
      if (term && !dev.name.toLowerCase().includes(term)) return false;
      if (statusFilter && dev.phase !== statusFilter) return false;
      if (requestedFrom || requestedTo) {
        if (!dev.requestedAt) return false;
        const requested = dev.requestedAt.slice(0, 10);
        if (requestedFrom && requested < requestedFrom) return false;
        if (requestedTo && requested > requestedTo) return false;
      }
      return true;
    });
  }, [developments, search, statusFilter, requestedFrom, requestedTo]);

  function openCreateForm() {
    setForm(EMPTY_FORM);
    setError('');
    setShowForm(true);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/developments', form);
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePhaseChange(dev, phase) {
    try {
      const data = await api.put(`/developments/${dev.id}`, { phase });
      setDevelopments((prev) => prev.map((d) => (d.id === dev.id ? data.development : d)));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setImportResult(null);
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const data = await api.post('/developments/import', formData, { isFormData: true });
      setImportResult(data);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Developments</h1>
        {can('manageDevelopments') && (
          <div className="table__actions">
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleImport}
              hidden
              id="import-input"
            />
            <label htmlFor="import-input" className="btn btn--secondary">
              {importing ? 'Importing...' : 'Import from Excel'}
            </label>
            <button className="btn btn--primary" onClick={openCreateForm}>
              New Development
            </button>
          </div>
        )}
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {importResult && (
        <div className="alert alert--success import-summary">
          <p>
            Imported {importResult.createdCount} development(s).
            {importResult.skipped.length > 0 && ` ${importResult.skipped.length} row(s) skipped.`}
          </p>
          {importResult.created.some((c) => c.warnings.length > 0) && (
            <ul>
              {importResult.created
                .filter((c) => c.warnings.length > 0)
                .map((c) => (
                  <li key={c.row}>
                    Row {c.row} ({c.name}): {c.warnings.join('; ')}
                  </li>
                ))}
            </ul>
          )}
          {importResult.skipped.length > 0 && (
            <ul>
              {importResult.skipped.map((s) => (
                <li key={s.row}>
                  Row {s.row} skipped: {s.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {showForm && (
        <Modal title="New Development" onClose={() => setShowForm(false)}>
          <form className="form" onSubmit={handleCreate}>
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
        </Modal>
      )}

      {developments.length > 0 && (
        <div className="developments-toolbar">
          <div className="developments-toolbar__filters">
            <input
              type="text"
              className="search-input"
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              {DEVELOPMENT_PHASES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <label className="filter-date">
              <span>Requested from</span>
              <input type="date" value={requestedFrom} onChange={(e) => setRequestedFrom(e.target.value)} />
            </label>
            <label className="filter-date">
              <span>Requested to</span>
              <input type="date" value={requestedTo} onChange={(e) => setRequestedTo(e.target.value)} />
            </label>
          </div>
          <div className="view-toggle">
            <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')}>
              Grid
            </button>
            <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>
              List
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p>Loading...</p>
      ) : developments.length === 0 ? (
        <div className="empty-state">No developments yet.</div>
      ) : filteredDevelopments.length === 0 ? (
        <div className="empty-state">No developments match your filters.</div>
      ) : view === 'list' ? (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Description</th>
              <th>Requested</th>
              <th>Created</th>
              <th>Tasks</th>
              <th>By</th>
            </tr>
          </thead>
          <tbody>
            {filteredDevelopments.map((dev) => (
              <tr key={dev.id}>
                <td>
                  <Link className="table__link" to={`/developments/${dev.id}`}>
                    {dev.name}
                  </Link>
                </td>
                <td>
                  {can('manageDevelopments') ? (
                    <select
                      className="select--phase"
                      value={dev.phase}
                      onChange={(e) => handlePhaseChange(dev, e.target.value)}
                    >
                      {DEVELOPMENT_PHASES.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <PhaseBadge phase={dev.phase} list={DEVELOPMENT_PHASES} />
                  )}
                </td>
                <td className="table__description">{dev.description}</td>
                <td>{dev.requestedAt ? new Date(dev.requestedAt).toLocaleDateString() : '—'}</td>
                <td>{new Date(dev.createdAt).toLocaleDateString()}</td>
                <td>{dev.taskCount}</td>
                <td>{dev.createdByName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="grid">
          {filteredDevelopments.map((dev) => (
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
