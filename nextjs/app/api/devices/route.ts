import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb, dbAll, dbRun } from '@/lib/db';
import { getParentFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const parent = getParentFromRequest(req);
  if (!parent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = await getDb();
  const devices = dbAll(db, 'SELECT id, name, last_seen, created_at FROM devices WHERE parent_id = ?', [parent.id]);
  return NextResponse.json({ devices });
}

export async function POST(req: NextRequest) {
  const parent = getParentFromRequest(req);
  if (!parent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { name } = await req.json();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  const db = await getDb();
  const id = uuidv4();
  const token = uuidv4();
  dbRun(db, 'INSERT INTO devices (id, parent_id, name, token) VALUES (?, ?, ?, ?)', [id, parent.id, name, token]);
  dbRun(db, 'INSERT INTO settings (device_id) VALUES (?)', [id]);
  return NextResponse.json({ device: { id, name, token } });
}
