import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { db, nowSeconds, DEFAULT_SETTINGS } from '@/lib/firestore';
import { getParentFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const parent = getParentFromRequest(req);
  if (!parent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const snap = await db.collection('devices').where('parent_id', '==', parent.id).get();
  const devices = snap.docs.map((d) => {
    const data = d.data();
    return { id: d.id, name: data.name, last_seen: data.last_seen ?? null, created_at: data.created_at };
  });
  return NextResponse.json({ devices });
}

export async function POST(req: NextRequest) {
  const parent = getParentFromRequest(req);
  if (!parent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { name } = await req.json();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  const id = uuidv4();
  const token = uuidv4();
  await db.collection('devices').doc(id).set({
    parent_id: parent.id,
    name,
    token,
    last_seen: null,
    created_at: nowSeconds(),
  });
  await db.collection('settings').doc(id).set({ ...DEFAULT_SETTINGS, updated_at: nowSeconds() });
  return NextResponse.json({ device: { id, name, token } });
}
