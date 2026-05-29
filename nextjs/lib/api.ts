const BASE = '/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('oversight_token');
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function req<T>(method: string, path: string, body?: any): Promise<T> {
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
  register: (email: string, password: string, name: string) =>
    req('POST', '/auth/register', { email, password, name }),
  login: (email: string, password: string) =>
    req('POST', '/auth/login', { email, password }),
  me: () => req('GET', '/auth/me'),

  // Devices
  listDevices: () => req<{ devices: any[] }>('GET', '/devices'),
  addDevice: (name: string) => req<{ device: any }>('POST', '/devices', { name }),
  deleteDevice: (id: string) => req('DELETE', `/devices/${id}`),

  // Settings
  getSettings: (deviceId: string) => req<any>('GET', `/devices/${deviceId}/settings`),
  updateSettings: (deviceId: string, settings: any) =>
    req('PUT', `/devices/${deviceId}/settings`, settings),

  // Usage
  getUsage: (deviceId: string, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return req<any>('GET', `/devices/${deviceId}/usage?${params}`);
  },

  // Pairing
  generatePairCode: (name: string) => req<any>('POST', '/pair/generate', { name }),
  getPairStatus: (code: string) => req<any>('GET', `/pair/${code}/status`),

  // Screen
  getScreenFrame: (deviceId: string) => req<any>('GET', `/devices/${deviceId}/screen`),
  toggleScreenStream: (deviceId: string, enabled: boolean) =>
    req('PUT', `/devices/${deviceId}/screen/toggle`, { enabled }),

  // Import
  importDomains: async (deviceId: string, file: File) => {
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
