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

export const SENIOR_ONLY_TASK_PHASES = new Set(['approved', 'done']);

export function labelFor(list, value) {
  return list.find((item) => item.value === value)?.label ?? value;
}
