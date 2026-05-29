import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firestore';
import { getParentFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const parent = getParentFromRequest(req);
  if (!parent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const snap = await db.collection('pair_codes').doc(params.code).get();
  if (!snap.exists || snap.data()?.parent_id !== parent.id) {
    return NextResponse.json({ error: 'Code not found' }, { status: 404 });
  }
  const row = snap.data()!;
  if (row.claimed_at) {
    return NextResponse.json({ claimed: true, device_id: row.device_id });
  }
  return NextResponse.json({ claimed: false });
}
