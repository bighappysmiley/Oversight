import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb, dbGet } from '@/lib/db';
import { signToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: 'email and password required' }, { status: 400 });
  }
  const db = await getDb();
  const parent = dbGet(db, 'SELECT * FROM parents WHERE email = ?', [email]);
  if (!parent) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  const ok = await bcrypt.compare(password, parent.password_hash);
  if (!ok) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  const token = signToken({ id: parent.id, email: parent.email, name: parent.name });
  return NextResponse.json({ token, parent: { id: parent.id, email: parent.email, name: parent.name } });
}
