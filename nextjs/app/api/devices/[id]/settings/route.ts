import { NextRequest, NextResponse } from 'next/server';
import { getDb, dbGet, dbRun } from '@/lib/db';
import { getParentFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const parent = getParentFromRequest(req);
  if (!parent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = await getDb();
  const device = dbGet(db, 'SELECT * FROM devices WHERE id = ? AND parent_id = ?', [params.id, parent.id]);
  if (!device) return NextResponse.json({ error: 'Device not found' }, { status: 404 });
  const settings = dbGet(db, 'SELECT * FROM settings WHERE device_id = ?', [device.id]);
  if (!settings) return NextResponse.json({ error: 'Settings not found' }, { status: 404 });
  return NextResponse.json({
    app_limits: JSON.parse(settings.app_limits),
    downtime: JSON.parse(settings.downtime),
    website_restrictions: JSON.parse(settings.website_restrictions),
    updated_at: settings.updated_at,
  });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const parent = getParentFromRequest(req);
  if (!parent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = await getDb();
  const device = dbGet(db, 'SELECT * FROM devices WHERE id = ? AND parent_id = ?', [params.id, parent.id]);
  if (!device) return NextResponse.json({ error: 'Device not found' }, { status: 404 });
  const body = await req.json();
  const { app_limits, downtime, website_restrictions } = body;
  const current = dbGet(db, 'SELECT * FROM settings WHERE device_id = ?', [device.id]);
  dbRun(db, `UPDATE settings SET app_limits = ?, downtime = ?, website_restrictions = ?, updated_at = strftime('%s','now') WHERE device_id = ?`, [
    JSON.stringify(app_limits ?? JSON.parse(current.app_limits)),
    JSON.stringify(downtime ?? JSON.parse(current.downtime)),
    JSON.stringify(website_restrictions ?? JSON.parse(current.website_restrictions)),
    device.id,
  ]);
  return NextResponse.json({ ok: true });
}
