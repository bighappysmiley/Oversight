import { NextRequest, NextResponse } from 'next/server';
import { getDb, dbGet, dbRun } from '@/lib/db';
import { getDeviceTokenFromRequest } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const token = getDeviceTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: 'Missing device token' }, { status: 401 });
  const db = await getDb();
  const device = dbGet(db, 'SELECT * FROM devices WHERE token = ?', [token]);
  if (!device) return NextResponse.json({ error: 'Unknown device' }, { status: 401 });
  dbRun(db, "UPDATE devices SET last_seen = strftime('%s','now') WHERE id = ?", [device.id]);

  const { app_usage, web_usage, date } = await req.json();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date required in YYYY-MM-DD format' }, { status: 400 });
  }

  for (const entry of (app_usage || [])) {
    dbRun(db, `INSERT INTO usage_logs (device_id, app_name, bundle_id, duration_seconds, date)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(device_id, app_name, date) DO UPDATE SET
        duration_seconds = MAX(duration_seconds, excluded.duration_seconds)`,
      [device.id, entry.app_name, entry.bundle_id || null, entry.duration_seconds, date]);
  }
  for (const entry of (web_usage || [])) {
    dbRun(db, `INSERT INTO web_logs (device_id, domain, visits, date)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(device_id, domain, date) DO UPDATE SET
        visits = MAX(visits, excluded.visits)`,
      [device.id, entry.domain, entry.visits || 1, date]);
  }

  return NextResponse.json({ ok: true });
}
