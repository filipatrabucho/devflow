import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { DEVELOPMENT_PHASES, TASK_PHASES, MANAGER_ONLY_TASK_PHASES } from '../constants';
import PhaseBadge from '../components/PhaseBadge';
import Avatar from '../components/Avatar';

export default function DevelopmentDetail() {
  const { id } = useParams();
  const { user, can } = useAuth();
  const canManageDevelopments = can('manageDevelopments');
  const canManageTasks = can('manageTasks');

  const [development, setDevelopment] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', assignedTo: '' });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [devData, taskData, userData] = await Promise.all([
        api.get(`/developments/${id}`),
        api.get(`/developments/${id}/tasks`),
        api.get('/users'),
      ]);
      setDevelopment(devData.development);
      setTasks(taskData.tasks);
      setUsers(userData.users);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handlePhaseChange(phase) {
    try {
      const data = await api.put(`/developments/${id}`, { phase });
      setDevelopment(data.development);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreateTask(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post(`/developments/${id}/tasks`, {
        title: form.title,
        description: form.description,
        assignedTo: form.assignedTo || null,
      });
      setForm({ title: '', description: '', assignedTo: '' });
      setShowForm(false);
      const taskData = await api.get(`/developments/${id}/tasks`);
      setTasks(taskData.tasks);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleTaskPhaseChange(task, phase) {
    try {
      const data = await api.put(`/tasks/${task.id}`, { phase });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? data.task : t)));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAssigneeChange(task, assignedTo) {
    try {
      const data = await api.put(`/tasks/${task.id}`, { assignedTo: assignedTo || null });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? data.task : t)));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteTask(taskId) {
    if (!window.confirm('Delete this task?')) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p>Loading...</p>;
  if (!development) return <div className="alert alert--error">Development not found.</div>;

  return (
    <div>
      <Link to="/" className="back-link">
        ‹ Back to Developments
      </Link>

      <div className="page-header">
        <div>
          <h1>{development.name}</h1>
          {development.description && <p className="muted">{development.description}</p>}
        </div>
        {canManageDevelopments ? (
          <select
            className="select--phase"
            value={development.phase}
            onChange={(e) => handlePhaseChange(e.target.value)}
          >
            {DEVELOPMENT_PHASES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        ) : (
          <PhaseBadge phase={development.phase} list={DEVELOPMENT_PHASES} />
        )}
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      <div className="page-header">
        <h2>Tasks</h2>
        {canManageTasks && (
          <button className="btn btn--primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : 'New Task'}
          </button>
        )}
      </div>

      {showForm && (
        <form className="card form" onSubmit={handleCreateTask}>
          <label className="field">
            <span>Title</span>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              minLength={2}
              maxLength={200}
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
            <span>Assign to</span>
            <select
              value={form.assignedTo}
              onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
            >
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn--primary" type="submit" disabled={saving}>
            {saving ? 'Creating...' : 'Create task'}
          </button>
        </form>
      )}

      {tasks.length === 0 ? (
        <div className="empty-state">No tasks yet.</div>
      ) : (
        <div className="task-list">
          {tasks.map((task) => {
            const canEditPhase = canManageTasks || task.assignedTo === user.id;
            const phaseOptions = canManageTasks
              ? TASK_PHASES
              : TASK_PHASES.filter((p) => !MANAGER_ONLY_TASK_PHASES.has(p.value) || p.value === task.phase);

            return (
              <div className="task-row" key={task.id}>
                <div className="task-row__main">
                  <strong>{task.title}</strong>
                  {task.description && <p className="muted">{task.description}</p>}
                </div>

                <div className="task-row__assignee">
                  {canManageTasks ? (
                    <select
                      value={task.assignedTo || ''}
                      onChange={(e) => handleAssigneeChange(task, e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  ) : task.assignedToName ? (
                    <div className="assignee-chip">
                      <Avatar name={task.assignedToName} src={task.assignedToAvatar} size={24} />
                      <span>{task.assignedToName}</span>
                    </div>
                  ) : (
                    <span className="muted">Unassigned</span>
                  )}
                </div>

                <div className="task-row__phase">
                  {canEditPhase ? (
                    <select
                      value={task.phase}
                      onChange={(e) => handleTaskPhaseChange(task, e.target.value)}
                    >
                      {phaseOptions.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <PhaseBadge phase={task.phase} list={TASK_PHASES} />
                  )}
                  {task.validatedByName && (
                    <div className="validated-note">
                      Validated by {task.validatedByName} on{' '}
                      {new Date(task.validatedAt).toLocaleDateString()}
                    </div>
                  )}
                </div>

                {canManageTasks && (
                  <button className="btn btn--ghost btn--danger" onClick={() => handleDeleteTask(task.id)}>
                    Delete
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
