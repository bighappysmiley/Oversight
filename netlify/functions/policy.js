import {
  requireAccount,
  stores,
  getPolicy,
  defaultPolicy,
  json,
  readJson,
  unauthorized,
  methodNotAllowed,
} from '../lib/util.js';

function cleanDomains(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    if (typeof raw !== 'string') continue;
    // Normalise: strip scheme, path, whitespace and leading "www."
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

export default async (req) => {
  const account = await requireAccount(req);
  if (!account) return unauthorized();

  if (req.method === 'GET') {
    return json({ policy: await getPolicy(account.id) });
  }

  if (req.method === 'PUT') {
    const body = await readJson(req);
    const base = defaultPolicy();
    const policy = {
      filterAdultContent: body.filterAdultContent ?? base.filterAdultContent,
      safeSearch: body.safeSearch ?? base.safeSearch,
      blockSocialMedia: body.blockSocialMedia ?? base.blockSocialMedia,
      mode: body.mode === 'allowlist' ? 'allowlist' : 'blocklist',
      blockedDomains: cleanDomains(body.blockedDomains),
      allowedDomains: cleanDomains(body.allowedDomains),
      blockedCategories: Array.isArray(body.blockedCategories)
        ? body.blockedCategories.filter((c) => typeof c === 'string').slice(0, 50)
        : base.blockedCategories,
      updatedAt: new Date().toISOString(),
    };
    await stores.policies().setJSON(account.id, policy);
    return json({ ok: true, policy });
  }

  return methodNotAllowed();
};

export const config = { path: '/api/policy' };
