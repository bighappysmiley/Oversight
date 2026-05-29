import { NextRequest, NextResponse } from 'next/server';
import { getDb, dbGet, dbAll } from '@/lib/db';
import { getParentFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const parent = getParentFromRequest(req);
  if (!parent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = await getDb();
  const device = dbGet(db, 'SELECT * FROM devices WHERE id = ? AND parent_id = ?', [params.id, parent.id]);
  if (!device) return NextResponse.json({ error: 'Device not found' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const fromDate = searchParams.get('from') || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const toDate = searchParams.get('to') || new Date().toISOString().slice(0, 10);

  const appUsage = dbAll(db,
    `SELECT app_name, bundle_id, SUM(duration_seconds) as total_seconds, date
     FROM usage_logs WHERE device_id = ? AND date >= ? AND date <= ?
     GROUP BY app_name, bundle_id, date ORDER BY date, total_seconds DESC`,
    [device.id, fromDate, toDate]
  );

  const webUsage = dbAll(db,
    `SELECT domain, SUM(visits) as total_visits, date
     FROM web_logs WHERE device_id = ? AND date >= ? AND date <= ?
     GROUP BY domain, date ORDER BY date, total_visits DESC`,
    [device.id, fromDate, toDate]
  );

  return NextResponse.json({ app_usage: appUsage, web_usage: webUsage });
}
