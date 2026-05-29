import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getDb, dbGet, dbRun } from '@/lib/db';
import { signToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { email, password, name } = await req.json();
  if (!email || !password || !name) {
    return NextResponse.json({ error: 'email, password, name required' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  }
  const db = await getDb();
  if (dbGet(db, 'SELECT id FROM parents WHERE email = ?', [email])) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
  }
  const hash = await bcrypt.hash(password, 12);
  const id = uuidv4();
  dbRun(db, 'INSERT INTO parents (id, email, password_hash, name) VALUES (?, ?, ?, ?)', [id, email, hash, name]);
  const token = signToken({ id, email, name });
  return NextResponse.json({ token, parent: { id, email, name } });
}
