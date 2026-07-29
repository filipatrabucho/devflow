import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { TASK_PHASES } from '../constants';
import PhaseBarChart from '../components/PhaseBarChart';
import Avatar from '../components/Avatar';

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
        <div className="card dashboard-card">
          <h3>My pending tasks</h3>
          <div className="stat-number">{data.myPendingTasks}</div>
          <p className="muted">Tasks assigned to you that aren't Done yet.</p>
          <Link className="muted-link" to="/my-tasks">
            View my tasks →
          </Link>
        </div>

        <div className="card dashboard-card dashboard-card--wide">
          <h3>My tasks by phase</h3>
          <PhaseBarChart data={data.myTasksByPhase} list={TASK_PHASES} />
        </div>

        {data.overview && (
          <>
            <div className="card dashboard-card">
              <h3>Developments awaiting response</h3>
              <div className="stat-number">{data.overview.developmentsAwaitingResponse}</div>
              <p className="muted">Waiting List or In Search.</p>
              <Link className="muted-link" to="/developments">
                View developments →
              </Link>
            </div>

            <div className="card dashboard-card">
              <h3>Developments in progress, still pending</h3>
              <div className="stat-number">{data.overview.developmentsInProgressPending}</div>
              <p className="muted">In Development / In Production with tasks not yet Done.</p>
              <Link className="muted-link" to="/developments">
                View developments →
              </Link>
            </div>

            <div className="card dashboard-card dashboard-card--wide">
              <h3>Team tasks by phase</h3>
              <PhaseBarChart data={data.overview.tasksByPhase} list={TASK_PHASES} />
            </div>

            <div className="card dashboard-card dashboard-card--wide">
              <h3>Staff without pending tasks</h3>
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
              <p className="muted staff-roster__note">
                Which roles count as "staff" here can be changed on the{' '}
                <Link className="muted-link" to="/roles">
                  Roles
                </Link>{' '}
                page.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
