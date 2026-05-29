import { NextRequest, NextResponse } from 'next/server';
import { getDb, dbGet, dbRun } from '@/lib/db';
import { getDeviceTokenFromRequest } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const token = getDeviceTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: 'Missing device token' }, { status: 401 });
  const db = await getDb();
  const device = dbGet(db, 'SELECT * FROM devices WHERE token = ?', [token]);
  if (!device) return NextResponse.json({ error: 'Unknown device' }, { status: 401 });

  const { frame, captured_at } = await req.json();
  if (!frame || !captured_at) return NextResponse.json({ error: 'frame and captured_at required' }, { status: 400 });

  dbRun(db, `INSERT INTO screen_frames (device_id, frame_data, captured_at, streaming_enabled)
    VALUES (?, ?, ?, 1)
    ON CONFLICT(device_id) DO UPDATE SET
      frame_data = excluded.frame_data,
      captured_at = excluded.captured_at`,
    [device.id, frame, captured_at]);

  return NextResponse.json({ ok: true });
}
