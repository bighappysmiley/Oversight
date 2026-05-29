import { NextRequest, NextResponse } from 'next/server';
import { db, getOwnedDevice } from '@/lib/firestore';
import { getParentFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const parent = getParentFromRequest(req);
  if (!parent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const device = await getOwnedDevice(params.id, parent.id);
  if (!device) return NextResponse.json({ error: 'Device not found' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const fromDate = searchParams.get('from') || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const toDate = searchParams.get('to') || new Date().toISOString().slice(0, 10);

  const usageSnap = await db
    .collection('usage_logs')
    .where('device_id', '==', device.id)
    .where('date', '>=', fromDate)
    .where('date', '<=', toDate)
    .get();

  // Aggregate per (app_name, bundle_id, date). Each doc is already unique per
  // (device, app, date), but we sum defensively.
  const appMap = new Map<string, { app_name: string; bundle_id: string | null; total_seconds: number; date: string }>();
  for (const d of usageSnap.docs) {
    const r = d.data();
    const key = `${r.app_name}|${r.bundle_id ?? ''}|${r.date}`;
    const cur = appMap.get(key);
    if (cur) cur.total_seconds += Number(r.duration_seconds || 0);
    else appMap.set(key, { app_name: r.app_name, bundle_id: r.bundle_id ?? null, total_seconds: Number(r.duration_seconds || 0), date: r.date });
  }
  const appUsage = Array.from(appMap.values()).sort(
    (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : b.total_seconds - a.total_seconds)
  );

  const webSnap = await db
    .collection('web_logs')
    .where('device_id', '==', device.id)
    .where('date', '>=', fromDate)
    .where('date', '<=', toDate)
    .get();

  const webMap = new Map<string, { domain: string; total_visits: number; date: string }>();
  for (const d of webSnap.docs) {
    const r = d.data();
    const key = `${r.domain}|${r.date}`;
    const cur = webMap.get(key);
    if (cur) cur.total_visits += Number(r.visits || 0);
    else webMap.set(key, { domain: r.domain, total_visits: Number(r.visits || 0), date: r.date });
  }
  const webUsage = Array.from(webMap.values()).sort(
    (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : b.total_visits - a.total_visits)
  );

  return NextResponse.json({ app_usage: appUsage, web_usage: webUsage });
}
