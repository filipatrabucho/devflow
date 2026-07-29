import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { TASK_PHASES } from '../constants';
import PhaseBarChart from '../components/PhaseBarChart';
import Avatar from '../components/Avatar';

function InfoDot({ text }) {
  return (
    <span className="info-dot" title={text} aria-label={text}>
      i
    </span>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const result = await api.get('/dashboard');
        setData(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <p>Loading...</p>;
  if (error) return <div className="alert alert--error">{error}</div>;
  if (!data) return null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">Welcome back, {user?.name}.</p>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-row dashboard-row--stats">
          <div className="card dashboard-card">
            <h3>
              My pending tasks
              <InfoDot text="Tasks assigned to you that aren't Done yet." />
            </h3>
            <div className="stat-number">{data.myPendingTasks}</div>
            <Link className="muted-link" to="/my-tasks">
              View →
            </Link>
          </div>

          {data.overview && (
            <>
              <div className="card dashboard-card">
                <h3>
                  Awaiting response
                  <InfoDot text="Developments in Waiting List or In Search." />
                </h3>
                <div className="stat-number">{data.overview.developmentsAwaitingResponse}</div>
                <Link className="muted-link" to="/developments">
                  View →
                </Link>
              </div>

              <div className="card dashboard-card">
                <h3>
                  In progress, pending
                  <InfoDot text="Developments In Development / In Production that still have tasks not yet Done." />
                </h3>
                <div className="stat-number">{data.overview.developmentsInProgressPending}</div>
                <Link className="muted-link" to="/developments">
                  View →
                </Link>
              </div>
            </>
          )}
        </div>

        <div className="dashboard-row dashboard-row--charts">
          <div className="card dashboard-card">
            <h3>My tasks by phase</h3>
            <PhaseBarChart data={data.myTasksByPhase} list={TASK_PHASES} />
          </div>

          {data.overview && (
            <div className="card dashboard-card">
              <h3>Team tasks by phase</h3>
              <PhaseBarChart data={data.overview.tasksByPhase} list={TASK_PHASES} />
            </div>
          )}
        </div>

        {data.overview && (
          <div className="card dashboard-card">
            <div className="dashboard-card__header-row">
              <h3>
                Staff without pending tasks
                <InfoDot text="Staff roles with zero tasks that aren't Done yet. Choose which roles count as staff on the Roles page." />
              </h3>
              <Link className="muted-link" to="/roles">
                Roles →
              </Link>
            </div>
            {data.overview.staffWithoutTasks.length === 0 ? (
              <p className="muted">Everyone on staff currently has at least one pending task.</p>
            ) : (
              <div className="staff-roster">
                {data.overview.staffWithoutTasks.map((s) => (
                  <div className="staff-roster__chip" key={s.id}>
                    <Avatar name={s.name} size={28} />
                    <div>
                      <div className="staff-roster__name">{s.name}</div>
                      <div className="staff-roster__role muted">{s.roleLabel}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
