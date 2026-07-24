import { supabase } from '../supabaseClient';

const BASE_URL = '/api';

async function request(path, { method = 'GET', body, isFormData = false } = {}) {
  const headers = {};
  let payload = body;

  if (body !== undefined && !isFormData) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: payload,
  });

  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    const message = data?.error || `Request failed (${response.status})`;
    throw new Error(message);
  }

  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body, opts = {}) => request(path, { method: 'POST', body, ...opts }),
  put: (path, body, opts = {}) => request(path, { method: 'PUT', body, ...opts }),
  delete: (path) => request(path, { method: 'DELETE' }),
};
