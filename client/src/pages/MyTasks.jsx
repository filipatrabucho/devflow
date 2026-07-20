import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { TASK_PHASES, SENIOR_ONLY_TASK_PHASES } from '../constants';
import PhaseBadge from '../components/PhaseBadge';

export default function MyTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await api.get('/tasks/mine');
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

  async function handlePhaseChange(task, phase) {
    try {
      const data = await api.put(`/tasks/${task.id}`, { phase });
      setTasks((prev) => prev.map((t) => (t.id === task.id ? data.task : t)));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>My Tasks</h1>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {loading ? (
        <p>Loading...</p>
      ) : tasks.length === 0 ? (
        <div className="empty-state">You have no tasks assigned yet.</div>
      ) : (
        <div className="task-list">
          {tasks.map((task) => {
            const phaseOptions = TASK_PHASES.filter(
              (p) => !SENIOR_ONLY_TASK_PHASES.has(p.value) || p.value === task.phase
            );
            return (
              <div className="task-row" key={task.id}>
                <div className="task-row__main">
                  <strong>{task.title}</strong>
                  {task.description && <p className="muted">{task.description}</p>}
                  <Link className="muted-link" to={`/developments/${task.developmentId}`}>
                    {task.developmentName}
                  </Link>
                </div>
                <div className="task-row__phase">
                  {SENIOR_ONLY_TASK_PHASES.has(task.phase) ? (
                    <PhaseBadge phase={task.phase} list={TASK_PHASES} />
                  ) : (
                    <select value={task.phase} onChange={(e) => handlePhaseChange(task, e.target.value)}>
                      {phaseOptions.map((p) => (
                        <option key={p.value} value={p.value}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
