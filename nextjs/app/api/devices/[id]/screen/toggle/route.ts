import { NextRequest, NextResponse } from 'next/server';
import { getDb, dbGet, dbRun } from '@/lib/db';
import { getParentFromRequest } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const parent = getParentFromRequest(req);
  if (!parent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const { enabled } = body;
  if (typeof enabled !== 'boolean') return NextResponse.json({ error: 'enabled (boolean) required' }, { status: 400 });
  const db = await getDb();
  const device = dbGet(db, 'SELECT * FROM devices WHERE id = ? AND parent_id = ?', [params.id, parent.id]);
  if (!device) return NextResponse.json({ error: 'Device not found' }, { status: 404 });
  const existing = dbGet(db, 'SELECT * FROM screen_frames WHERE device_id = ?', [device.id]);
  if (existing) {
    dbRun(db, 'UPDATE screen_frames SET streaming_enabled = ? WHERE device_id = ?', [enabled ? 1 : 0, device.id]);
  } else {
    dbRun(db, 'INSERT INTO screen_frames (device_id, frame_data, captured_at, streaming_enabled) VALUES (?, ?, ?, ?)',
      [device.id, '', Math.floor(Date.now() / 1000), enabled ? 1 : 0]);
  }
  return NextResponse.json({ ok: true, streaming_enabled: enabled });
}
