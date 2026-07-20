import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { TASK_PHASES } from '../constants';
import KanbanBoard from '../components/KanbanBoard';
import Avatar from '../components/Avatar';

export default function AllTasks() {
  const { can } = useAuth();
  const canManageTasks = can('manageTasks');

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await api.get('/tasks');
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

  async function handleMove(task, phase) {
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
        <div>
          <h1>All Tasks</h1>
          <p className="muted">
            {canManageTasks ? 'Drag a card to change its phase.' : 'Read-only overview of every task.'}
          </p>
        </div>
      </div>

      {error && <div className="alert alert--error">{error}</div>}

      {loading ? (
        <p>Loading...</p>
      ) : tasks.length === 0 ? (
        <div className="empty-state">No tasks yet.</div>
      ) : (
        <KanbanBoard
          columns={TASK_PHASES}
          tasks={tasks}
          canDrag={() => canManageTasks}
          canDrop={() => canManageTasks}
          onMove={handleMove}
          renderCard={(task) => (
            <>
              {task.developmentName && (
                <Link className="kanban__card-dev muted-link" to={`/developments/${task.developmentId}`}>
                  {task.developmentName}
                </Link>
              )}
              <div className="kanban__card-title">{task.title}</div>
              <div className="kanban__card-meta">
                {task.assignedToName ? (
                  <div className="assignee-chip">
                    <Avatar name={task.assignedToName} src={task.assignedToAvatar} size={20} />
                    <span>{task.assignedToName}</span>
                  </div>
                ) : (
                  <span className="muted">Unassigned</span>
                )}
              </div>
              {task.validatedByName && (
                <div className="validated-note">
                  Validated by {task.validatedByName} on {new Date(task.validatedAt).toLocaleDateString()}
                </div>
              )}
            </>
          )}
        />
      )}
    </div>
  );
}
