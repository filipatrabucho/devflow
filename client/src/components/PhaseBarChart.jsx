import { TASK_PHASE_COLORS } from '../constants';

export default function PhaseBarChart({ data, list }) {
  const max = Math.max(1, ...list.map((p) => data[p.value] || 0));
  const total = list.reduce((sum, p) => sum + (data[p.value] || 0), 0);

  if (total === 0) {
    return <p className="muted">No tasks yet.</p>;
  }

  return (
    <div className="phase-bar-chart">
      {list.map((p) => {
        const count = data[p.value] || 0;
        const pct = Math.round((count / max) * 100);
        return (
          <div className="phase-bar-chart__row" key={p.value}>
            <span className="phase-bar-chart__label">{p.label}</span>
            <div className="phase-bar-chart__track">
              <div
                className="phase-bar-chart__fill"
                style={{ width: `${pct}%`, background: TASK_PHASE_COLORS[p.value] }}
              />
            </div>
            <span className="phase-bar-chart__count">{count}</span>
          </div>
        );
      })}
    </div>
  );
}
