import {
  requireAccount,
  stores,
  getPolicy,
  defaultPolicy,
  defaultPolicyKey,
  devicePolicyKey,
  json,
  readJson,
  unauthorized,
  methodNotAllowed,
} from '../lib/util.js';

const MODES = ['auto', 'blocklist', 'allowlist'];

function cleanDomains(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    if (typeof raw !== 'string') continue;
    let d = raw.trim().toLowerCase();
    d = d.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
    if (!d || !d.includes('.') || /\s/.test(d)) continue;
    if (!seen.has(d)) {
      seen.add(d);
      out.push(d);
    }
  }
  return out.slice(0, 2000);
}

function validTime(t) {
  return typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? t : null;
}

function cleanPackages(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const r of list) {
    if (typeof r !== 'string') continue;
    const p = r.trim().toLowerCase();
    if (/^[a-z0-9_.]+$/.test(p) && p.includes('.') && !seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
  }
  return out.slice(0, 500);
}

function cleanAppLimits(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const out = {};
  let n = 0;
  for (const [k, v] of Object.entries(obj)) {
    if (n++ >= 500) break;
    if (/^[a-z0-9_.]+$/.test(k) && k.includes('.')) {
      const m = parseInt(v, 10);
      if (Number.isFinite(m) && m >= 0 && m <= 1440) out[k] = m;
    }
  }
  return out;
}

export default async (req) => {
  const account = await requireAccount(req);
  if (!account) return unauthorized();

  const url = new URL(req.url);
  const device = url.searchParams.get('device');
  const isDevice = device && device !== 'default';

  // Resolve the storage key and verify device ownership.
  let key;
  if (isDevice) {
    const dev = await stores.devices().get(`${account.id}:${device}`, { type: 'json' });
    if (!dev) return json({ error: 'Device not found.' }, { status: 404 });
    key = devicePolicyKey(account.id, device);
  } else {
    key = defaultPolicyKey(account.id);
  }

  if (req.method === 'GET') {
    const stored = await stores.policies().get(key, { type: 'json' });
    // Fall back to the default template / hard default if this target has none.
    const policy = stored || (isDevice ? await getPolicy(account.id, device) : defaultPolicy());
    return json({ policy });
  }

  if (req.method === 'PUT') {
    const body = await readJson(req);
    const base = defaultPolicy();
    const mode = MODES.includes(body.mode) ? body.mode : 'auto';
    const policy = {
      mode,
      // Automatic mode always filters adult content.
      filterAdultContent: mode === 'auto' ? true : (body.filterAdultContent ?? base.filterAdultContent),
      safeSearch: body.safeSearch ?? base.safeSearch,
      blockSocialMedia: body.blockSocialMedia ?? base.blockSocialMedia,
      blockedDomains: cleanDomains(body.blockedDomains),
      allowedDomains: cleanDomains(body.allowedDomains),
      blockedCategories: Array.isArray(body.blockedCategories)
        ? body.blockedCategories.filter((c) => typeof c === 'string').slice(0, 50)
        : base.blockedCategories,
      blockAppStore: !!body.blockAppStore,
      downtime: {
        enabled: !!(body.downtime && body.downtime.enabled),
        start: validTime(body.downtime && body.downtime.start) || '21:00',
        end: validTime(body.downtime && body.downtime.end) || '07:00',
      },
      blockedApps: cleanPackages(body.blockedApps),
      appLimits: cleanAppLimits(body.appLimits),
      updatedAt: new Date().toISOString(),
    };
    await stores.policies().setJSON(key, policy);
    return json({ ok: true, policy });
  }

  return methodNotAllowed();
};

export const config = { path: '/api/policy' };
