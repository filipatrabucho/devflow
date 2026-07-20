import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { TASK_PHASES, MANAGER_ONLY_TASK_PHASES } from '../constants';
import PhaseBadge from '../components/PhaseBadge';
import KanbanBoard from '../components/KanbanBoard';
import TaskComments from '../components/TaskComments';

export default function MyTasks() {
  const { can } = useAuth();
  const canManageTasks = can('manageTasks');
  const canValidate = can('validateTasks');

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState('list');
  const [openCommentsId, setOpenCommentsId] = useState(null);

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
        <div className="view-toggle">
          <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>
            List
          </button>
          <button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')}>
            Board
          </button>
        </div>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {loading ? (
        <p>Loading...</p>
      ) : tasks.length === 0 ? (
        <div className="empty-state">You have no tasks assigned yet.</div>
      ) : view === 'board' ? (
        <KanbanBoard
          columns={TASK_PHASES}
          tasks={tasks}
          canDrag={(task) => canManageTasks || !MANAGER_ONLY_TASK_PHASES.has(task.phase)}
          canDrop={(columnValue) => canManageTasks || !MANAGER_ONLY_TASK_PHASES.has(columnValue)}
          onMove={(task, phase) => handlePhaseChange(task, phase)}
          renderCard={(task) => (
            <>
              {task.developmentName && <div className="kanban__card-dev">{task.developmentName}</div>}
              <div className="kanban__card-title">{task.title}</div>
              {task.validatedByName && (
                <div className="validated-note">
                  Validated by {task.validatedByName} on {new Date(task.validatedAt).toLocaleDateString()}
                </div>
              )}
            </>
          )}
        />
      ) : (
        <div className="task-list">
          {tasks.map((task) => {
            const phaseOptions = TASK_PHASES.filter(
              (p) => !MANAGER_ONLY_TASK_PHASES.has(p.value) || p.value === task.phase
            );
            return (
              <div className="task-card" key={task.id}>
                <div className="validation-card__row">
                  <div className="task-row__main">
                    <strong>{task.title}</strong>
                    {task.description && <p className="muted">{task.description}</p>}
                    <Link className="muted-link" to={`/developments/${task.developmentId}`}>
                      {task.developmentName}
                    </Link>
                    <button
                      className="task-row__comments-toggle"
                      onClick={() => setOpenCommentsId((prev) => (prev === task.id ? null : task.id))}
                    >
                      {openCommentsId === task.id ? 'Hide comments' : `Comments (${task.commentCount || 0})`}
                    </button>
                  </div>
                  <div className="task-row__phase">
                    {task.validatedByName ? (
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
                    {task.validatedByName && (
                      <div className="validated-note">
                        Validated by {task.validatedByName} on{' '}
                        {new Date(task.validatedAt).toLocaleDateString()}
                        {(canManageTasks || canValidate) && (
                          <button
                            className="btn btn--ghost btn--reopen"
                            onClick={() => handlePhaseChange(task, 'in_validation')}
                          >
                            Reopen
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {openCommentsId === task.id && <TaskComments taskId={task.id} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
