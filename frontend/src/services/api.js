// Thin fetch wrapper: attaches the JWT and turns server errors into readable messages.
export async function api(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('sf_token');
  let res;
  try {
    res = await fetch('/api' + path, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
      body: body ? JSON.stringify(body) : undefined });
  } catch { throw new Error('Cannot reach the server. Check your connection and try again.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.message || 'Something went wrong. Please try again.'); e.status = res.status; throw e; }
  return data;
}

export async function upload(path, formData) {
  let res;
  try { res = await fetch('/api' + path, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('sf_token')}` }, body: formData }); }
  catch { throw new Error('Cannot reach the server. Check your connection and try again.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Unable to analyze the resume. Please try again.');
  return data;
}
