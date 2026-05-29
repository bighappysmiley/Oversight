import { NextRequest, NextResponse } from 'next/server';
import { db, getDeviceByToken } from '@/lib/firestore';
import { getDeviceTokenFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = getDeviceTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: 'Missing device token' }, { status: 401 });
  const device = await getDeviceByToken(token);
  if (!device) return NextResponse.json({ error: 'Unknown device' }, { status: 401 });
  const snap = await db.collection('screen_frames').doc(device.id).get();
  return NextResponse.json({ enabled: snap.exists ? snap.data()?.streaming_enabled === true : false });
}
