const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  return EMAIL_RE.test(email.trim().toLowerCase());
}

export function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

export function isStrongPassword(password) {
  return typeof password === 'string' && password.length >= 8 && password.length <= 128;
}

export const DEVELOPMENT_PHASES = ['waiting_list', 'in_search', 'in_development', 'in_production'];
export const TASK_PHASES = ['not_started', 'in_progress', 'in_validation', 'approved', 'done'];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateString(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime());
}
