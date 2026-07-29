export const DEVELOPMENT_PHASES = [
  { value: 'waiting_list', label: 'Waiting List' },
  { value: 'in_search', label: 'In Search' },
  { value: 'in_development', label: 'In Development' },
  { value: 'in_production', label: 'In Production' },
];

export const TASK_PHASES = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_validation', label: 'In Validation' },
  { value: 'approved', label: 'Approved' },
  { value: 'done', label: 'Done' },
];

export const MANAGER_ONLY_TASK_PHASES = new Set(['approved', 'done']);

// Same semantics as the .badge--{phase} colors in index.css, reused for the
// Dashboard's phase bar charts so a phase reads the same color everywhere.
export const TASK_PHASE_COLORS = {
  not_started: '#4b5566',
  in_progress: '#8a6100',
  in_validation: '#1a3fb0',
  approved: '#12703f',
  done: '#0d5230',
};

export function labelFor(list, value) {
  return list.find((item) => item.value === value)?.label ?? value;
}
