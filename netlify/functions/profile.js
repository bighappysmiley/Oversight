// Generates and serves the iOS/iPadOS configuration profile for a child device.
// Reached on the child's device via /enroll, which links to
//   /api/profile?code=XXXX&name=DeviceName
import {
  stores,
  getAccountById,
  ensureDevicePolicy,
  decryptSecret,
  json,
} from '../lib/util.js';
import { buildProfile } from '../lib/mobileconfig.js';

function sanitizeName(name) {
  const n = (name || '').toString().trim().slice(0, 40).replace(/[^\w \-]/g, '');
  return n || 'iOS device';
}

export default async (req) => {
  const url = new URL(req.url);
  const code = (url.searchParams.get('code') || '').trim().toUpperCase();
  const name = sanitizeName(url.searchParams.get('name'));

  const enrollment = await stores.enrollments().get(code, { type: 'json' });
  if (!enrollment || new Date(enrollment.expiresAt) < new Date()) {
    return json({ error: 'This setup link has expired. Generate a new one in the dashboard.' }, { status: 410 });
  }

  const account = await getAccountById(enrollment.accountId);
  if (!account || !account.protectionEnc) {
    return json({ error: 'Account is not ready for enrollment.' }, { status: 400 });
  }

  const removalPassword = await decryptSecret(account.protectionEnc);

  const deviceId = `ios-${code}`;
  await stores.devices().setJSON(`${account.id}:${deviceId}`, {
    id: deviceId,
    accountId: account.id,
    name: enrollment.name || name,
    platform: 'ios',
    enrolledAt: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    status: 'active',
  });

  const policy = await ensureDevicePolicy(account.id, deviceId);
  const profile = buildProfile({
    suffix: code.toLowerCase(),
    removalPassword,
    policy,
  });

  return new Response(profile, {
    status: 200,
    headers: {
      'Content-Type': 'application/x-apple-aspen-config; charset=utf-8',
      'Content-Disposition': 'attachment; filename="Oversight.mobileconfig"',
      'Cache-Control': 'no-store',
    },
  });
};

export const config = { path: '/api/profile' };
