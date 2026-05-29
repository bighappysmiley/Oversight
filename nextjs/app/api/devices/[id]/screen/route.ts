import { NextRequest, NextResponse } from 'next/server';
import { db, getOwnedDevice } from '@/lib/firestore';
import { getParentFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const parent = getParentFromRequest(req);
  if (!parent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const device = await getOwnedDevice(params.id, parent.id);
  if (!device) return NextResponse.json({ error: 'Device not found' }, { status: 404 });
  const snap = await db.collection('screen_frames').doc(device.id).get();
  if (!snap.exists || !snap.data()?.frame_data) {
    return NextResponse.json({ error: 'No frame yet' }, { status: 404 });
  }
  const row = snap.data()!;
  return NextResponse.json({
    frame: row.frame_data,
    captured_at: row.captured_at,
    streaming_enabled: row.streaming_enabled === true,
  });
}
