import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { TASK_PHASES } from '../constants';
import PhaseBarChart from '../components/PhaseBarChart';
import Avatar from '../components/Avatar';
import { DevelopmentsIcon, ListIcon, TasksIcon, ValidationIcon } from '../components/icons';

function InfoDot({ text }) {
  return (
    <span className="info-tooltip" tabIndex={0}>
      <span className="info-dot" aria-label={text}>
        i
      </span>
      <span className="info-tooltip__bubble" role="tooltip">
        {text}
      </span>
    </span>
  );
}

function StatCard({ icon, color, title, tooltip, value, to, linkLabel = 'View →' }) {
  return (
    <div className="card dashboard-card">
      <div className="dashboard-card__icon-row">
        <span className="dashboard-card__icon" style={{ background: color }}>
          {icon}
        </span>
        <h3>
          {title}
          {tooltip && <InfoDot text={tooltip} />}
        </h3>
      </div>
      <div className="stat-number">{value}</div>
      <Link className="muted-link" to={to}>
        {linkLabel}
      </Link>
    </div>
  );
}

export default function Dashboard() {
  const { user, can } = useAuth();
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
          <StatCard
            icon={<TasksIcon />}
            color="var(--color-primary)"
            title="My pending tasks"
            tooltip="Tasks assigned to you that aren't Done yet."
            value={data.myPendingTasks}
            to="/my-tasks"
          />

          {can('validateTasks') && data.pendingValidationCount !== null && (
            <StatCard
              icon={<ValidationIcon />}
              color="#c2760a"
              title="Tasks to validate"
              tooltip="Tasks currently In Validation, waiting for you to approve or reject them."
              value={data.pendingValidationCount}
              to="/validation"
            />
          )}

          {data.overview && (
            <>
              <StatCard
                icon={<DevelopmentsIcon />}
                color="#1a3fb0"
                title="Awaiting response"
                tooltip="Developments in Waiting List or In Search."
                value={data.overview.developmentsAwaitingResponse}
                to="/developments"
              />

              <StatCard
                icon={<ListIcon />}
                color="#12703f"
                title="In progress, pending"
                tooltip="Developments In Development / In Production that still have tasks not yet Done."
                value={data.overview.developmentsInProgressPending}
                to="/developments"
              />
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
