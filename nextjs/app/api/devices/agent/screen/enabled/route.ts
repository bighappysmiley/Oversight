import { NextRequest, NextResponse } from 'next/server';
import { getDb, dbGet } from '@/lib/db';
import { getDeviceTokenFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = getDeviceTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: 'Missing device token' }, { status: 401 });
  const db = await getDb();
  const device = dbGet(db, 'SELECT * FROM devices WHERE token = ?', [token]);
  if (!device) return NextResponse.json({ error: 'Unknown device' }, { status: 401 });
  const row = dbGet(db, 'SELECT streaming_enabled FROM screen_frames WHERE device_id = ?', [device.id]);
  return NextResponse.json({ enabled: row ? Number(row.streaming_enabled) === 1 : false });
}
