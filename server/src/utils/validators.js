const ALLOWED_EMAIL_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN || '@pkf.pt').toLowerCase();

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function isValidCompanyEmail(email) {
  if (typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  return EMAIL_RE.test(normalized) && normalized.endsWith(ALLOWED_EMAIL_DOMAIN);
}

export function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

export function isStrongPassword(password) {
  return typeof password === 'string' && password.length >= 8 && password.length <= 128;
}

export const DEVELOPMENT_PHASES = ['waiting_list', 'in_search', 'in_development', 'in_production'];
export const TASK_PHASES = ['not_started', 'in_progress', 'in_validation', 'approved', 'done'];
export const USER_ROLES = ['senior', 'developer'];
