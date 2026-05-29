import { NextRequest, NextResponse } from 'next/server';
import { getDb, dbRun } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { email, platform } = await req.json();
  if (!email || !platform) {
    return NextResponse.json({ error: 'email and platform required' }, { status: 400 });
  }
  const db = await getDb();
  dbRun(db, 'INSERT INTO waitlist (email, platform) VALUES (?, ?)', [email, platform]);
  return NextResponse.json({ ok: true });
}
