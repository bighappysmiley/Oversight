import { NextRequest, NextResponse } from 'next/server';
import { getDb, dbGet } from '@/lib/db';
import { getParentFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const parent = getParentFromRequest(req);
  if (!parent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = await getDb();
  const row = dbGet(db, 'SELECT * FROM pair_codes WHERE code = ? AND parent_id = ?', [params.code, parent.id]);
  if (!row) return NextResponse.json({ error: 'Code not found' }, { status: 404 });
  if (row.claimed_at) {
    return NextResponse.json({ claimed: true, device_id: row.device_id });
  }
  return NextResponse.json({ claimed: false });
}
