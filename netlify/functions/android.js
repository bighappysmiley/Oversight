// Completes Android enrollment. The Oversight Android app calls this after the
// parent types the enrollment code shown in the dashboard:
//   GET /api/android/config?code=XXXX&name=DeviceName
//
// Returns the device token (used for ongoing policy sync) and the device's
// content policy. The removal password is verified server-side via
// /api/agent/verify, so no password material is sent to the device.
import crypto from 'node:crypto';
import {
  stores,
  getAccountById,
  ensureDevicePolicy,
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

  const platforms = { android: 'and', macos: 'mac', windows: 'win', linux: 'lnx' };
  const reqPlat = (url.searchParams.get('platform') || 'android').toLowerCase();
  const plat = platforms[reqPlat] ? reqPlat : 'android';
  const deviceId = `${platforms[plat]}-${code}`;
  const token = crypto.randomBytes(24).toString('hex');

  await stores.devices().setJSON(`${account.id}:${deviceId}`, {
    id: deviceId,
    accountId: account.id,
    name: enrollment.name || name,
    platform: plat,
    token,
    enrolledAt: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    status: 'active',
  });
  await stores.deviceTokens().setJSON(token, { accountId: account.id, deviceId });

  const policy = await ensureDevicePolicy(account.id, deviceId);

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
