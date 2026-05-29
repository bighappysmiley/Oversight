import { NextRequest, NextResponse } from 'next/server';
import { getDb, dbRun } from '@/lib/db';
import { getParentFromRequest } from '@/lib/auth';

function randomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(req: NextRequest) {
  const parent = getParentFromRequest(req);
  if (!parent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { name } = await req.json();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const db = await getDb();
  dbRun(db, "DELETE FROM pair_codes WHERE expires_at < strftime('%s','now')", []);

  const code = randomCode();
  const expires_at = Math.floor(Date.now() / 1000) + 600;
  dbRun(db, 'INSERT INTO pair_codes (code, parent_id, device_name, expires_at) VALUES (?, ?, ?, ?)',
    [code, parent.id, name, expires_at]);

  return NextResponse.json({ code, expires_at });
}
