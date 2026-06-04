import {
  requireAccount,
  stores,
  json,
  unauthorized,
  methodNotAllowed,
} from '../lib/util.js';

export default async (req) => {
  const account = await requireAccount(req);
  if (!account) return unauthorized();

  const store = stores.devices();
  const prefix = account.id + ':';

  if (req.method === 'GET') {
    const { blobs } = await store.list({ prefix });
    const devices = [];
    for (const b of blobs) {
      const d = await store.get(b.key, { type: 'json' });
      if (d) devices.push(d);
    }
    devices.sort((a, b) => (b.enrolledAt || '').localeCompare(a.enrolledAt || ''));
    return json({ devices });
  }

  if (req.method === 'DELETE') {
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return json({ error: 'Missing device id.' }, { status: 400 });
    const key = prefix + id;
    const device = await store.get(key, { type: 'json' });
    if (!device) return json({ error: 'Device not found.' }, { status: 404 });

    // Revoke any agent token tied to this device (Android).
    if (device.token) {
      await stores.deviceTokens().delete(device.token).catch(() => {});
    }
    await store.delete(key);
    return json({ ok: true });
  }

  return methodNotAllowed();
};

export const config = { path: '/api/devices' };
