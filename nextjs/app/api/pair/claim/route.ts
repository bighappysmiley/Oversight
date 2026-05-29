import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb, dbGet, dbRun } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { code, device_fingerprint } = await req.json();
  if (!code || !device_fingerprint) {
    return NextResponse.json({ error: 'code and device_fingerprint required' }, { status: 400 });
  }

  const db = await getDb();
  const row = dbGet(db, 'SELECT * FROM pair_codes WHERE code = ?', [code]);
  if (!row) return NextResponse.json({ error: 'Invalid pairing code' }, { status: 404 });
  if (row.claimed_at) return NextResponse.json({ error: 'Code already claimed' }, { status: 409 });
  if (row.expires_at < Math.floor(Date.now() / 1000)) {
    return NextResponse.json({ error: 'Pairing code expired' }, { status: 410 });
  }

  const device_id = uuidv4();
  const device_token = uuidv4();

  dbRun(db, 'INSERT INTO devices (id, parent_id, name, token) VALUES (?, ?, ?, ?)',
    [device_id, row.parent_id, row.device_name, device_token]);
  dbRun(db, 'INSERT INTO settings (device_id) VALUES (?)', [device_id]);
  dbRun(db, "UPDATE pair_codes SET device_id = ?, claimed_at = strftime('%s','now') WHERE code = ?",
    [device_id, code]);

  return NextResponse.json({ device_id, device_token });
}
