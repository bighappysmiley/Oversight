import { NextRequest, NextResponse } from 'next/server';
import { getDb, dbGet, dbRun } from '@/lib/db';
import { getDeviceTokenFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = getDeviceTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: 'Missing device token' }, { status: 401 });
  const db = await getDb();
  const device = dbGet(db, 'SELECT * FROM devices WHERE token = ?', [token]);
  if (!device) return NextResponse.json({ error: 'Unknown device' }, { status: 401 });
  dbRun(db, "UPDATE devices SET last_seen = strftime('%s','now') WHERE id = ?", [device.id]);
  const settings = dbGet(db, 'SELECT * FROM settings WHERE device_id = ?', [device.id]);
  if (!settings) return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
  return NextResponse.json({
    app_limits: JSON.parse(settings.app_limits),
    downtime: JSON.parse(settings.downtime),
    website_restrictions: JSON.parse(settings.website_restrictions),
    updated_at: settings.updated_at,
  });
}
