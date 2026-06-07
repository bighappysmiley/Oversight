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
  SOCIAL_MEDIA_DOMAINS,
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

  // Plain-text policy feed for desktop agents (macOS/Windows/Linux). First line
  // carries directives; the rest are hosts-file block entries.
  if (action === 'hosts' && req.method === 'GET') {
    const policy = await getPolicy(ref.accountId, ref.deviceId);
    await touch(ref);
    const lines = [];
    const safedns = policy.safeDns !== false ? 'on' : 'off';
    lines.push(`# oversight safedns=${safedns} mode=${policy.mode || 'auto'} updated=${policy.updatedAt || ''}`);
    if (policy.mode !== 'allowlist') {
      const blocked = new Set(policy.blockedDomains || []);
      if (policy.blockSocialMedia) for (const d of SOCIAL_MEDIA_DOMAINS) blocked.add(d);
      const allowed = new Set(policy.allowedDomains || []);
      for (const d of blocked) {
        if (allowed.has(d)) continue;
        lines.push(`0.0.0.0 ${d}`);
        lines.push(`0.0.0.0 www.${d}`);
      }
    }
    return new Response(lines.join('\n') + '\n', {
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    });
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
