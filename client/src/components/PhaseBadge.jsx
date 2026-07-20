import { labelFor } from '../constants';

export default function PhaseBadge({ phase, list }) {
  return <span className={`badge badge--${phase}`}>{labelFor(list, phase)}</span>;
}
