import { NextRequest, NextResponse } from 'next/server';
import { db, getOwnedDevice, nowSeconds, DEFAULT_SETTINGS } from '@/lib/firestore';
import { getParentFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const parent = getParentFromRequest(req);
  if (!parent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const device = await getOwnedDevice(params.id, parent.id);
  if (!device) return NextResponse.json({ error: 'Device not found' }, { status: 404 });
  const snap = await db.collection('settings').doc(device.id).get();
  const s = snap.exists ? snap.data()! : { ...DEFAULT_SETTINGS, updated_at: nowSeconds() };
  return NextResponse.json({
    app_limits: s.app_limits ?? DEFAULT_SETTINGS.app_limits,
    downtime: s.downtime ?? DEFAULT_SETTINGS.downtime,
    website_restrictions: s.website_restrictions ?? DEFAULT_SETTINGS.website_restrictions,
    updated_at: s.updated_at ?? null,
  });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const parent = getParentFromRequest(req);
  if (!parent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const device = await getOwnedDevice(params.id, parent.id);
  if (!device) return NextResponse.json({ error: 'Device not found' }, { status: 404 });
  const body = await req.json();
  const { app_limits, downtime, website_restrictions } = body;

  const update: any = { updated_at: nowSeconds() };
  if (app_limits !== undefined) update.app_limits = app_limits;
  if (downtime !== undefined) update.downtime = downtime;
  if (website_restrictions !== undefined) update.website_restrictions = website_restrictions;

  await db.collection('settings').doc(device.id).set(update, { merge: true });
  return NextResponse.json({ ok: true });
}
