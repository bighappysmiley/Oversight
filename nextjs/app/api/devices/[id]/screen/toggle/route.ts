import { NextRequest, NextResponse } from 'next/server';
import { db, getOwnedDevice, nowSeconds } from '@/lib/firestore';
import { getParentFromRequest } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const parent = getParentFromRequest(req);
  if (!parent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const { enabled } = body;
  if (typeof enabled !== 'boolean') return NextResponse.json({ error: 'enabled (boolean) required' }, { status: 400 });
  const device = await getOwnedDevice(params.id, parent.id);
  if (!device) return NextResponse.json({ error: 'Device not found' }, { status: 404 });

  const ref = db.collection('screen_frames').doc(device.id);
  const snap = await ref.get();
  if (snap.exists) {
    await ref.set({ streaming_enabled: enabled }, { merge: true });
  } else {
    await ref.set({ frame_data: '', captured_at: nowSeconds(), streaming_enabled: enabled });
  }
  return NextResponse.json({ ok: true, streaming_enabled: enabled });
}
