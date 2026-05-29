import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { db, nowSeconds, DEFAULT_SETTINGS } from '@/lib/firestore';

export async function POST(req: NextRequest) {
  const { code, device_fingerprint } = await req.json();
  if (!code || !device_fingerprint) {
    return NextResponse.json({ error: 'code and device_fingerprint required' }, { status: 400 });
  }

  const codeRef = db.collection('pair_codes').doc(String(code));
  const snap = await codeRef.get();
  if (!snap.exists) return NextResponse.json({ error: 'Invalid pairing code' }, { status: 404 });
  const row = snap.data()!;
  if (row.claimed_at) return NextResponse.json({ error: 'Code already claimed' }, { status: 409 });
  if (row.expires_at < nowSeconds()) {
    return NextResponse.json({ error: 'Pairing code expired' }, { status: 410 });
  }

  const device_id = uuidv4();
  const device_token = uuidv4();

  await db.collection('devices').doc(device_id).set({
    parent_id: row.parent_id,
    name: row.device_name,
    token: device_token,
    last_seen: null,
    created_at: nowSeconds(),
  });
  await db.collection('settings').doc(device_id).set({ ...DEFAULT_SETTINGS, updated_at: nowSeconds() });
  await codeRef.set({ device_id, claimed_at: nowSeconds() }, { merge: true });

  return NextResponse.json({ device_id, device_token });
}
