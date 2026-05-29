import { NextRequest, NextResponse } from 'next/server';
import { getDb, dbGet } from '@/lib/db';
import { getParentFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const parent = getParentFromRequest(req);
  if (!parent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = await getDb();
  const device = dbGet(db, 'SELECT * FROM devices WHERE id = ? AND parent_id = ?', [params.id, parent.id]);
  if (!device) return NextResponse.json({ error: 'Device not found' }, { status: 404 });
  const row = dbGet(db, 'SELECT * FROM screen_frames WHERE device_id = ?', [device.id]);
  if (!row) return NextResponse.json({ error: 'No frame yet' }, { status: 404 });
  return NextResponse.json({
    frame: row.frame_data,
    captured_at: row.captured_at,
    streaming_enabled: Number(row.streaming_enabled) === 1,
  });
}
