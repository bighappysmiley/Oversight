const BASE = '/api';

function getToken() {
  return localStorage.getItem('oversight_token');
}

function headers(extra = {}) {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  // Auth
  register: (email, password, name) => req('POST', '/auth/register', { email, password, name }),
  login: (email, password) => req('POST', '/auth/login', { email, password }),
  me: () => req('GET', '/auth/me'),

  // Devices
  listDevices: () => req('GET', '/devices'),
  addDevice: (name) => req('POST', '/devices', { name }),
  deleteDevice: (id) => req('DELETE', `/devices/${id}`),

  // Settings
  getSettings: (deviceId) => req('GET', `/devices/${deviceId}/settings`),
  updateSettings: (deviceId, settings) => req('PUT', `/devices/${deviceId}/settings`, settings),

  // Usage
  getUsage: (deviceId, from, to) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return req('GET', `/devices/${deviceId}/usage?${params}`);
  },

  // Pairing
  generatePairCode: (name) => req('POST', '/pair/generate', { name }),
  getPairStatus: (code) => req('GET', `/pair/${code}/status`),

  // Screen
  getScreenFrame: (deviceId) => req('GET', `/devices/${deviceId}/screen`),
  toggleScreenStream: (deviceId, enabled) => req('PUT', `/devices/${deviceId}/screen/toggle`, { enabled }),

  // Waitlist
  joinWaitlist: (email, platform) => req('POST', '/auth/waitlist', { email, platform }),

  // iOS profile
  getIosProfileUrl: (deviceToken) => `${BASE}/install/ios-profile${deviceToken ? '?token=' + deviceToken : ''}`,

  // Import
  importDomains: async (deviceId, file) => {
    const token = getToken();
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${BASE}/devices/${deviceId}/import/domains`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Import failed');
    return data;
  },
};
