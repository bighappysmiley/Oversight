// Ongoing sync endpoint for the Android app (device-token authenticated).
//   GET  /api/agent/policy   -> current policy
//   POST /api/agent/checkin  -> heartbeat (updates lastSeen)
//   POST /api/agent/verify   -> { password } -> { ok } removal-password check
import {
  stores,
  getAccountById,
  getPolicy,
  decryptSecret,
  json,
  readJson,
  methodNotAllowed,
} from '../lib/util.js';

async function authDevice(req) {
  const token = req.headers.get('x-device-token');
  if (!token) return null;
  const ref = await stores.deviceTokens().get(token, { type: 'json' });
  if (!ref) return null;
  return ref; // { accountId, deviceId }
}

async function touch(ref) {
  const key = `${ref.accountId}:${ref.deviceId}`;
  const device = await stores.devices().get(key, { type: 'json' });
  if (device) {
    device.lastSeen = new Date().toISOString();
    await stores.devices().setJSON(key, device);
  }
}

export default async (req) => {
  const action = new URL(req.url).pathname.split('/').pop();
  const ref = await authDevice(req);
  if (!ref) return json({ error: 'Invalid device token.' }, { status: 401 });

  if (action === 'policy' && req.method === 'GET') {
    const policy = await getPolicy(ref.accountId, ref.deviceId);
    await touch(ref);
    return json({ policy });
  }

  if (action === 'checkin' && req.method === 'POST') {
    await touch(ref);
    return json({ ok: true });
  }

  // The Android app reports the device's installed (launchable) apps so the
  // parent can pick which to block or limit by name.
  if (action === 'apps' && req.method === 'POST') {
    const body = await readJson(req);
    const key = `${ref.accountId}:${ref.deviceId}`;
    const device = await stores.devices().get(key, { type: 'json' });
    if (device) {
      const apps = Array.isArray(body.apps)
        ? body.apps
            .filter((a) => a && typeof a.pkg === 'string')
            .slice(0, 1000)
            .map((a) => ({
              pkg: String(a.pkg).slice(0, 200),
              label: String(a.label || a.pkg).slice(0, 100),
            }))
        : [];
      device.apps = apps;
      device.lastSeen = new Date().toISOString();
      await stores.devices().setJSON(key, device);
    }
    return json({ ok: true });
  }

  // Verify the parent's device-protection password before allowing the app to
  // deactivate device administration / be uninstalled.
  if (action === 'verify' && req.method === 'POST') {
    const account = await getAccountById(ref.accountId);
    if (!account || !account.protectionEnc) return json({ ok: false });
    const { password } = await readJson(req);
    const real = await decryptSecret(account.protectionEnc);
    return json({ ok: typeof password === 'string' && password === real });
  }

  return methodNotAllowed();
};

export const config = { path: '/api/agent/:action' };
