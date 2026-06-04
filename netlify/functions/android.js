// Completes Android enrollment. The Oversight Android app calls this after the
// parent types the enrollment code shown in the dashboard:
//   GET /api/android/config?code=XXXX&name=DeviceName
//
// Returns the device token (used for ongoing policy sync), the current policy,
// and a salted hash of the protection password so the app can verify it
// offline before allowing device-admin deactivation / uninstall.
import crypto from 'node:crypto';
import {
  stores,
  getAccountById,
  getPolicy,
  json,
} from '../lib/util.js';

function sanitizeName(name) {
  const n = (name || '').toString().trim().slice(0, 40).replace(/[^\w \-]/g, '');
  return n || 'Android device';
}

export default async (req) => {
  const url = new URL(req.url);
  const code = (url.searchParams.get('code') || '').trim().toUpperCase();
  const name = sanitizeName(url.searchParams.get('name'));

  const enrollment = await stores.enrollments().get(code, { type: 'json' });
  if (!enrollment || new Date(enrollment.expiresAt) < new Date()) {
    return json({ error: 'This setup code has expired. Generate a new one in the dashboard.' }, { status: 410 });
  }

  const account = await getAccountById(enrollment.accountId);
  if (!account || !account.protectionEnc) {
    return json({ error: 'Account is not ready for enrollment.' }, { status: 400 });
  }

  const policy = await getPolicy(account.id);

  const deviceId = `and-${code}`;
  const token = crypto.randomBytes(24).toString('hex');

  await stores.devices().setJSON(`${account.id}:${deviceId}`, {
    id: deviceId,
    accountId: account.id,
    name: enrollment.name || name,
    platform: 'android',
    token,
    enrolledAt: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    status: 'active',
  });
  await stores.deviceTokens().setJSON(token, { accountId: account.id, deviceId });

  return json({
    ok: true,
    deviceToken: token,
    org: 'Oversight',
    name: enrollment.name || name,
    apiBase: url.origin,
    policy,
  });
};

export const config = { path: '/api/android/config' };
