// API client: attaches the JWT, supports a single safe retry for transient network issues,
// logs detailed errors to the console, and produces user-friendly error messages.

async function fetchWithRetry(url, options = {}, retries = 1, backoffMs = 300) {
  try {
    return await fetch(url, options);
  } catch (err) {
    if (retries > 0) {
      console.warn(`[Network Retry] Request to ${url} failed, retrying after ${backoffMs}ms...`, err);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      return fetchWithRetry(url, options, retries - 1, backoffMs * 2);
    }
    console.error(`[Network Error] Unable to connect to ${url}:`, err);
    const networkError = new Error('Cannot reach the server. Check your connection and try again.');
    networkError.cause = err;
    throw networkError;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('sf_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && token.trim() ? { Authorization: `Bearer ${token.trim()}` } : {}),
  };

  const res = await fetchWithRetry('/api' + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`[API ${res.status}] ${method} /api${path}:`, data.message || res.statusText);
    const e = new Error(data.message || 'Something went wrong. Please try again.');
    e.status = res.status;
    e.data = data;
    throw e;
  }
  return data;
}

export async function upload(path, formData) {
  const token = localStorage.getItem('sf_token');
  const headers = {
    ...(token && token.trim() ? { Authorization: `Bearer ${token.trim()}` } : {}),
  };

  const res = await fetchWithRetry('/api' + path, {
    method: 'POST',
    headers,
    body: formData,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`[Upload ${res.status}] POST /api${path}:`, data.message || res.statusText);
    const e = new Error(data.message || 'Unable to analyze the resume. Please try again.');
    e.status = res.status;
    e.data = data;
    throw e;
  }
  return data;
}
