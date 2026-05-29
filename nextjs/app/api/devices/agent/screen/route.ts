import { NextRequest, NextResponse } from 'next/server';
import { db, getDeviceByToken } from '@/lib/firestore';
import { getDeviceTokenFromRequest } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const token = getDeviceTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: 'Missing device token' }, { status: 401 });
  const device = await getDeviceByToken(token);
  if (!device) return NextResponse.json({ error: 'Unknown device' }, { status: 401 });

  const { frame, captured_at } = await req.json();
  if (!frame || !captured_at) return NextResponse.json({ error: 'frame and captured_at required' }, { status: 400 });

  await db.collection('screen_frames').doc(device.id).set(
    { frame_data: frame, captured_at, streaming_enabled: true },
    { merge: true }
  );

  return NextResponse.json({ ok: true });
}
