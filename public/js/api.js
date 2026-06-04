// Tiny fetch wrapper for the Oversight JSON API.
async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  let data = null;
  try {
    data = await res.json();
  } catch (_) {
    /* non-JSON response */
  }
  if (!res.ok) {
    const msg = (data && data.error) || `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

const apiGet = (p) => api(p);
const apiPost = (p, body) => api(p, { method: 'POST', body: JSON.stringify(body || {}) });
const apiPut = (p, body) => api(p, { method: 'PUT', body: JSON.stringify(body || {}) });
const apiDel = (p) => api(p, { method: 'DELETE' });

// Show a message in an .alert element.
function showAlert(el, message, kind = 'error') {
  if (!el) return;
  el.className = `alert alert-${kind} show`;
  el.textContent = message;
}
function hideAlert(el) {
  if (el) el.className = 'alert';
}
