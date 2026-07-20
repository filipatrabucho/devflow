import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import Avatar from '../components/Avatar';
import TaskComments from '../components/TaskComments';

export default function Validation() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState({});
  const [openComments, setOpenComments] = useState(null);
  const [actingId, setActingId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get('/tasks/pending-validation');
      setTasks(data.tasks);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDecide(task, phase) {
    setError('');
    setActingId(task.id);
    try {
      await api.put(`/tasks/${task.id}`, { phase, comment: notes[task.id] || undefined });
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      setNotes((prev) => ({ ...prev, [task.id]: '' }));
    } catch (err) {
      setError(err.message);
    } finally {
      setActingId(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Validation</h1>
          <p className="muted">Tasks waiting for review across every development.</p>
        </div>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {loading ? (
        <p>Loading...</p>
      ) : tasks.length === 0 ? (
        <div className="empty-state">Nothing waiting for validation.</div>
      ) : (
        <div className="task-list">
          {tasks.map((task) => (
            <div className="validation-card" key={task.id}>
              <div className="validation-card__row">
                <div className="task-row__main">
                  <Link className="muted-link" to={`/developments/${task.developmentId}`}>
                    {task.developmentName}
                  </Link>
                  <strong>{task.title}</strong>
                  {task.description && <p className="muted">{task.description}</p>}
                </div>
                <div className="task-row__assignee">
                  {task.assignedToName ? (
                    <div className="assignee-chip">
                      <Avatar name={task.assignedToName} src={task.assignedToAvatar} size={24} />
                      <span>{task.assignedToName}</span>
                    </div>
                  ) : (
                    <span className="muted">Unassigned</span>
                  )}
                </div>
              </div>

              <label className="field">
                <span>Note (optional, logged with the decision)</span>
                <textarea
                  value={notes[task.id] || ''}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [task.id]: e.target.value }))}
                  rows={2}
                  placeholder="Why is this being approved or sent back?"
                />
              </label>

              <div className="table__actions">
                <button
                  className="btn btn--primary"
                  disabled={actingId === task.id}
                  onClick={() => handleDecide(task, 'approved')}
                >
                  Approve
                </button>
                <button
                  className="btn btn--secondary"
                  disabled={actingId === task.id}
                  onClick={() => handleDecide(task, 'in_progress')}
                >
                  Reject → In Progress
                </button>
                <button
                  className="btn btn--ghost"
                  onClick={() => setOpenComments((prev) => (prev === task.id ? null : task.id))}
                >
                  {openComments === task.id ? 'Hide history' : `History (${task.commentCount || 0})`}
                </button>
              </div>

              {openComments === task.id && <TaskComments taskId={task.id} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
