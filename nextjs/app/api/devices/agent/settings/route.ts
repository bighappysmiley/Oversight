import { NextRequest, NextResponse } from 'next/server';
import { db, getDeviceByToken, nowSeconds, DEFAULT_SETTINGS } from '@/lib/firestore';
import { getDeviceTokenFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = getDeviceTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: 'Missing device token' }, { status: 401 });
  const device = await getDeviceByToken(token);
  if (!device) return NextResponse.json({ error: 'Unknown device' }, { status: 401 });
  await db.collection('devices').doc(device.id).set({ last_seen: nowSeconds() }, { merge: true });

  const snap = await db.collection('settings').doc(device.id).get();
  const s = snap.exists ? snap.data()! : { ...DEFAULT_SETTINGS, updated_at: nowSeconds() };
  return NextResponse.json({
    app_limits: s.app_limits ?? DEFAULT_SETTINGS.app_limits,
    downtime: s.downtime ?? DEFAULT_SETTINGS.downtime,
    website_restrictions: s.website_restrictions ?? DEFAULT_SETTINGS.website_restrictions,
    updated_at: s.updated_at ?? null,
  });
}
