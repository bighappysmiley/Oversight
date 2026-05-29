import { NextRequest, NextResponse } from 'next/server';
import { db, getDeviceByToken, nowSeconds } from '@/lib/firestore';
import { getDeviceTokenFromRequest } from '@/lib/auth';

function sanitizeId(s: string): string {
  // Firestore doc ids cannot contain '/'. Replace any to keep ids stable.
  return s.replace(/\//g, '_');
}

export async function POST(req: NextRequest) {
  const token = getDeviceTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: 'Missing device token' }, { status: 401 });
  const device = await getDeviceByToken(token);
  if (!device) return NextResponse.json({ error: 'Unknown device' }, { status: 401 });
  await db.collection('devices').doc(device.id).set({ last_seen: nowSeconds() }, { merge: true });

  const { app_usage, web_usage, date } = await req.json();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date required in YYYY-MM-DD format' }, { status: 400 });
  }

  const batch = db.batch();
  for (const entry of (app_usage || [])) {
    if (!entry?.app_name) continue;
    const id = sanitizeId(`${device.id}_${date}_${entry.app_name}`);
    const ref = db.collection('usage_logs').doc(id);
    batch.set(ref, {
      device_id: device.id,
      app_name: entry.app_name,
      bundle_id: entry.bundle_id || null,
      duration_seconds: Number(entry.duration_seconds || 0),
      date,
      recorded_at: nowSeconds(),
    });
  }
  for (const entry of (web_usage || [])) {
    if (!entry?.domain) continue;
    const id = sanitizeId(`${device.id}_${date}_${entry.domain}`);
    const ref = db.collection('web_logs').doc(id);
    batch.set(ref, {
      device_id: device.id,
      domain: entry.domain,
      visits: Number(entry.visits || 1),
      date,
      recorded_at: nowSeconds(),
    });
  }
  await batch.commit();

  return NextResponse.json({ ok: true });
}
