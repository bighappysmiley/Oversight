// Enrollment code lifecycle.
//   POST /api/enroll/start  (parent, authenticated) -> create a short code
//   GET  /api/enroll/info?code=XXXX (public) -> validate code, return org info
//
// The parent generates a code in the dashboard, then opens
// /enroll?code=XXXX on the child's device to install protection.
import {
  requireAccount,
  stores,
  makeCode,
  json,
  readJson,
  unauthorized,
  methodNotAllowed,
} from '../lib/util.js';

const TTL_MS = 60 * 60 * 1000; // codes are valid for one hour

export default async (req) => {
  const url = new URL(req.url);
  const action = url.pathname.split('/').pop();

  if (action === 'start') {
    if (req.method !== 'POST') return methodNotAllowed();
    const account = await requireAccount(req);
    if (!account) return unauthorized();

    // A protection password must exist before a device can be locked down.
    if (!account.protectionEnc) {
      return json(
        { error: 'Set a device-protection password before adding a device.' },
        { status: 400 }
      );
    }

    const { name } = await readJson(req);
    const code = makeCode(8);
    const enrollment = {
      code,
      accountId: account.id,
      name: (typeof name === 'string' && name.trim()) || '',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + TTL_MS).toISOString(),
    };
    await stores.enrollments().setJSON(code, enrollment);
    return json({ ok: true, code, expiresAt: enrollment.expiresAt });
  }

  if (action === 'info') {
    if (req.method !== 'GET') return methodNotAllowed();
    const code = (url.searchParams.get('code') || '').trim().toUpperCase();
    const enrollment = await stores.enrollments().get(code, { type: 'json' });
    if (!enrollment || new Date(enrollment.expiresAt) < new Date()) {
      return json({ valid: false }, { status: 200 });
    }
    return json({ valid: true, name: enrollment.name });
  }

  return json({ error: 'Unknown action.' }, { status: 404 });
};

export const config = { path: '/api/enroll/:action' };
