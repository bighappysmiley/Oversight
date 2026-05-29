import { NextRequest, NextResponse } from 'next/server';
import { db, nowSeconds } from '@/lib/firestore';

export async function POST(req: NextRequest) {
  const { email, platform } = await req.json();
  if (!email || !platform) {
    return NextResponse.json({ error: 'email and platform required' }, { status: 400 });
  }
  await db.collection('waitlist').add({ email, platform, created_at: nowSeconds() });
  return NextResponse.json({ ok: true });
}
