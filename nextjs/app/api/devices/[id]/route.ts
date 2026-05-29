import { NextRequest, NextResponse } from 'next/server';
import { db, deleteByDevice } from '@/lib/firestore';
import { getParentFromRequest } from '@/lib/auth';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const parent = getParentFromRequest(req);
  if (!parent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const deviceRef = db.collection('devices').doc(params.id);
  const snap = await deviceRef.get();
  if (!snap.exists || snap.data()?.parent_id !== parent.id) {
    return NextResponse.json({ error: 'Device not found' }, { status: 404 });
  }
  await deleteByDevice('usage_logs', params.id);
  await deleteByDevice('web_logs', params.id);
  await db.collection('screen_frames').doc(params.id).delete();
  await db.collection('settings').doc(params.id).delete();
  await deviceRef.delete();
  return NextResponse.json({ ok: true });
}
