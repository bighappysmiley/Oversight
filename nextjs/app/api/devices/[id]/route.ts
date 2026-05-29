import { NextRequest, NextResponse } from 'next/server';
import { getDb, dbGet, dbRun } from '@/lib/db';
import { getParentFromRequest } from '@/lib/auth';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const parent = getParentFromRequest(req);
  if (!parent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = await getDb();
  const device = dbGet(db, 'SELECT * FROM devices WHERE id = ? AND parent_id = ?', [params.id, parent.id]);
  if (!device) return NextResponse.json({ error: 'Device not found' }, { status: 404 });
  dbRun(db, 'DELETE FROM usage_logs WHERE device_id = ?', [device.id]);
  dbRun(db, 'DELETE FROM web_logs WHERE device_id = ?', [device.id]);
  dbRun(db, 'DELETE FROM screen_frames WHERE device_id = ?', [device.id]);
  dbRun(db, 'DELETE FROM settings WHERE device_id = ?', [device.id]);
  dbRun(db, 'DELETE FROM devices WHERE id = ?', [device.id]);
  return NextResponse.json({ ok: true });
}
