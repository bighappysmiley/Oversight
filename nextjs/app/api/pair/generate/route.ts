import { NextRequest, NextResponse } from 'next/server';
import { db, nowSeconds } from '@/lib/firestore';
import { getParentFromRequest } from '@/lib/auth';

function randomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(req: NextRequest) {
  const parent = getParentFromRequest(req);
  if (!parent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { name } = await req.json();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  // Best-effort cleanup of expired, unclaimed codes.
  const now = nowSeconds();
  const expired = await db
    .collection('pair_codes')
    .where('expires_at', '<', now)
    .get();
  if (!expired.empty) {
    const batch = db.batch();
    expired.docs.forEach((d) => {
      if (!d.data().claimed_at) batch.delete(d.ref);
    });
    await batch.commit();
  }

  const code = randomCode();
  const expires_at = now + 600;
  await db.collection('pair_codes').doc(code).set({
    parent_id: parent.id,
    device_name: name,
    device_id: null,
    claimed_at: null,
    expires_at,
  });

  return NextResponse.json({ code, expires_at });
}
