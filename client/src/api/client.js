import { supabase } from '../supabaseClient';

const BASE_URL = '/api';

async function authHeader() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

async function request(path, { method = 'GET', body, isFormData = false } = {}) {
  const headers = { ...(await authHeader()) };
  let payload = body;

  if (body !== undefined && !isFormData) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: payload,
    });
  } catch {
    // fetch() itself throws (e.g. "Failed to fetch") when offline or the
    // server is unreachable — that raw browser wording means nothing to a
    // non-technical user, so replace it with something actionable.
    throw new Error('Could not reach the server. Check your internet connection and try again.');
  }

  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    const message = data?.error || `Request failed (${response.status})`;
    throw new Error(message);
  }

  return data;
}

// Triggers a browser download for a binary response (e.g. an Excel export),
// as opposed to `request()` above, which always expects JSON.
async function download(path) {
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, { headers: await authHeader() });
  } catch {
    throw new Error('Could not reach the server. Check your internet connection and try again.');
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    if ((response.headers.get('content-type') || '').includes('application/json')) {
      const data = await response.json();
      message = data?.error || message;
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const filename = disposition.match(/filename="?([^"]+)"?/)?.[1] || 'export.xlsx';

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  get: (path) => request(path),
  post: (path, body, opts = {}) => request(path, { method: 'POST', body, ...opts }),
  put: (path, body, opts = {}) => request(path, { method: 'PUT', body, ...opts }),
  delete: (path) => request(path, { method: 'DELETE' }),
  download,
};
