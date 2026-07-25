import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { DEVELOPMENT_PHASES, TASK_PHASES, MANAGER_ONLY_TASK_PHASES } from '../constants';
import PhaseBadge from '../components/PhaseBadge';
import Avatar from '../components/Avatar';
import TaskComments from '../components/TaskComments';
import Modal from '../components/Modal';

export default function DevelopmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, can } = useAuth();
  const canManageDevelopments = can('manageDevelopments');
  const canManageTasks = can('manageTasks');
  const canValidate = can('validateTasks');

  const [development, setDevelopment] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', assignedTo: '' });
  const [saving, setSaving] = useState(false);

  const [editingDev, setEditingDev] = useState(false);
  const [devForm, setDevForm] = useState({
    name: '',
    description: '',
    startDate: '',
    questions: '',
    observations: '',
    requestedAt: '',
    hoursEstimate: '',
    completionNotes: '',
  });
  const [savingDev, setSavingDev] = useState(false);

  const [editingTaskId, setEditingTaskId] = useState(null);
  const [taskForm, setTaskForm] = useState({ title: '', description: '' });
  const [openCommentsId, setOpenCommentsId] = useState(null);

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

  function startEditDev() {
    setDevForm({
      name: development.name,
      description: development.description || '',
      startDate: development.startDate ? development.startDate.slice(0, 10) : '',
      questions: development.questions || '',
      observations: development.observations || '',
      requestedAt: development.requestedAt ? development.requestedAt.slice(0, 10) : '',
      hoursEstimate: development.hoursEstimate || '',
      completionNotes: development.completionNotes || '',
    });
    setEditingDev(true);
  }

  async function handleSaveDev(e) {
    e.preventDefault();
    setSavingDev(true);
    setError('');
    try {
      const data = await api.put(`/developments/${id}`, {
        name: devForm.name,
        description: devForm.description,
        startDate: devForm.startDate || null,
        questions: devForm.questions,
        observations: devForm.observations,
        requestedAt: devForm.requestedAt || null,
        hoursEstimate: devForm.hoursEstimate,
        completionNotes: devForm.completionNotes,
      });
      setDevelopment(data.development);
      setEditingDev(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingDev(false);
    }
  }

  async function handleDeleteDev() {
    if (!window.confirm('Delete this development and all of its tasks?')) return;
    try {
      await api.delete(`/developments/${id}`);
      navigate('/', { replace: true });
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

  function startEditTask(task) {
    setTaskForm({ title: task.title, description: task.description || '' });
    setEditingTaskId(task.id);
  }

  async function handleSaveTask(e, taskId) {
    e.preventDefault();
    setError('');
    try {
      const data = await api.put(`/tasks/${taskId}`, {
        title: taskForm.title,
        description: taskForm.description,
      });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? data.task : t)));
      setEditingTaskId(null);
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

      {error && <div className="alert alert--error">{error}</div>}

      <div className="page-header">
        <div>
          <h1>{development.name}</h1>
          {development.description && <p className="muted">{development.description}</p>}
          <div className="card__dates">
            <span>Created {new Date(development.createdAt).toLocaleDateString()}</span>
            {development.startDate && (
              <span>Started {new Date(development.startDate).toLocaleDateString()}</span>
            )}
            {development.requestedAt && (
              <span>Requested {new Date(development.requestedAt).toLocaleDateString()}</span>
            )}
            {development.hoursEstimate && <span>Hours: {development.hoursEstimate}</span>}
          </div>
          {(development.questions || development.observations || development.completionNotes) && (
            <div className="dev-extra">
              {development.questions && (
                <div>
                  <span className="modal__fact-label">Questions</span>
                  <p>{development.questions}</p>
                </div>
              )}
              {development.observations && (
                <div>
                  <span className="modal__fact-label">Observations</span>
                  <p>{development.observations}</p>
                </div>
              )}
              {development.completionNotes && (
                <div>
                  <span className="modal__fact-label">Completion notes</span>
                  <p>{development.completionNotes}</p>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="table__actions">
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
          {canManageDevelopments && (
            <>
              <button className="btn btn--secondary" onClick={startEditDev}>
                Edit
              </button>
              <button className="btn btn--ghost btn--danger" onClick={handleDeleteDev}>
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {editingDev && (
        <Modal title="Edit Development" onClose={() => setEditingDev(false)}>
          <form className="form" onSubmit={handleSaveDev}>
            <label className="field">
              <span>Name</span>
              <input
                value={devForm.name}
                onChange={(e) => setDevForm({ ...devForm, name: e.target.value })}
                required
                minLength={2}
                maxLength={160}
              />
            </label>
            <label className="field">
              <span>Description</span>
              <textarea
                value={devForm.description}
                onChange={(e) => setDevForm({ ...devForm, description: e.target.value })}
                rows={3}
              />
            </label>
            <label className="field">
              <span>Start date</span>
              <input
                type="date"
                value={devForm.startDate}
                onChange={(e) => setDevForm({ ...devForm, startDate: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Questions</span>
              <textarea
                value={devForm.questions}
                onChange={(e) => setDevForm({ ...devForm, questions: e.target.value })}
                rows={3}
              />
            </label>
            <label className="field">
              <span>Observations</span>
              <textarea
                value={devForm.observations}
                onChange={(e) => setDevForm({ ...devForm, observations: e.target.value })}
                rows={3}
              />
            </label>
            <label className="field">
              <span>Requested date</span>
              <input
                type="date"
                value={devForm.requestedAt}
                onChange={(e) => setDevForm({ ...devForm, requestedAt: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Hours estimate</span>
              <input
                value={devForm.hoursEstimate}
                onChange={(e) => setDevForm({ ...devForm, hoursEstimate: e.target.value })}
                maxLength={50}
                placeholder="e.g. > 40h"
              />
            </label>
            <label className="field">
              <span>Completion notes</span>
              <textarea
                value={devForm.completionNotes}
                onChange={(e) => setDevForm({ ...devForm, completionNotes: e.target.value })}
                rows={2}
                maxLength={500}
              />
            </label>
            <div className="table__actions">
              <button className="btn btn--primary" type="submit" disabled={savingDev}>
                {savingDev ? 'Saving...' : 'Save'}
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setEditingDev(false)}>
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      <div className="page-header">
        <h2>Tasks</h2>
        {canManageTasks && (
          <button className="btn btn--primary" onClick={() => setShowForm(true)}>
            New Task
          </button>
        )}
      </div>

      {showForm && (
        <Modal title="New Task" onClose={() => setShowForm(false)}>
          <form className="form" onSubmit={handleCreateTask}>
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
        </Modal>
      )}

      {tasks.length === 0 ? (
        <div className="empty-state">No tasks yet.</div>
      ) : (
        <div className="task-list">
          {tasks.map((task) => {
            const isValidated = !!task.validatedByName;
            const canEditPhase = !isValidated && (canManageTasks || canValidate || task.assignedTo === user.id);
            const phaseOptions =
              canManageTasks || canValidate
                ? TASK_PHASES
                : TASK_PHASES.filter((p) => !MANAGER_ONLY_TASK_PHASES.has(p.value) || p.value === task.phase);

            return (
              <div className="task-card" key={task.id}>
                <div className="validation-card__row">
                  <div className="task-row__main">
                    <strong>{task.title}</strong>
                    {task.description && <p className="muted">{task.description}</p>}
                    <button
                      className="task-row__comments-toggle"
                      onClick={() => setOpenCommentsId((prev) => (prev === task.id ? null : task.id))}
                    >
                      {openCommentsId === task.id ? 'Hide comments' : `Comments (${task.commentCount || 0})`}
                    </button>
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
                    {isValidated && (
                      <div className="validated-note">
                        Validated by {task.validatedByName} on{' '}
                        {new Date(task.validatedAt).toLocaleDateString()}
                        {(canManageTasks || canValidate) && (
                          <button
                            className="btn btn--ghost btn--reopen"
                            onClick={() => handleTaskPhaseChange(task, 'in_validation')}
                          >
                            Reopen
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {canManageTasks && (
                    <div className="table__actions">
                      <button className="btn btn--secondary" onClick={() => startEditTask(task)}>
                        Edit
                      </button>
                      <button className="btn btn--ghost btn--danger" onClick={() => handleDeleteTask(task.id)}>
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                {openCommentsId === task.id && <TaskComments taskId={task.id} />}
              </div>
            );
          })}
        </div>
      )}

      {editingTaskId !== null && (
        <Modal title="Edit Task" onClose={() => setEditingTaskId(null)}>
          <form className="form" onSubmit={(e) => handleSaveTask(e, editingTaskId)}>
            <label className="field">
              <span>Title</span>
              <input
                value={taskForm.title}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                required
                minLength={2}
                maxLength={200}
              />
            </label>
            <label className="field">
              <span>Description</span>
              <textarea
                value={taskForm.description}
                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                rows={3}
              />
            </label>
            <div className="table__actions">
              <button className="btn btn--primary" type="submit">
                Save
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setEditingTaskId(null)}>
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
