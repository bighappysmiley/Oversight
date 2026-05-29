import { NextRequest, NextResponse } from 'next/server';
import { getDb, dbGet, dbRun } from '@/lib/db';
import { signToken } from '@/lib/auth';

const FIREBASE_API_KEY = 'AIzaSyBDjeQrrT-lwRcU1P8Kl6NjEpq9DURMQ-U';

export async function POST(req: NextRequest) {
  const { idToken, name: nameParam } = await req.json();
  if (!idToken) {
    return NextResponse.json({ error: 'idToken required' }, { status: 400 });
  }

  // Verify the Firebase ID token using the Firebase REST API
  let uid: string;
  let email: string;
  let displayName: string;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    const data = await res.json();
    if (!res.ok || !data.users || data.users.length === 0) {
      return NextResponse.json({ error: 'Invalid Firebase token' }, { status: 401 });
    }
    const user = data.users[0];
    uid = user.localId;
    email = user.email;
    displayName = user.displayName || nameParam || email.split('@')[0];
  } catch {
    return NextResponse.json({ error: 'Token verification failed' }, { status: 401 });
  }

  const db = await getDb();

  // Upsert parent record keyed by Firebase UID
  let parent = dbGet(db, 'SELECT * FROM parents WHERE id = ?', [uid]);
  if (!parent) {
    // Also check by email in case they registered via password flow previously
    parent = dbGet(db, 'SELECT * FROM parents WHERE email = ?', [email]);
  }

  if (!parent) {
    // Create a new parent record for this Firebase user (no password hash)
    dbRun(db, 'INSERT INTO parents (id, email, password_hash, name) VALUES (?, ?, ?, ?)', [
      uid,
      email,
      '', // Firebase users have no local password hash
      displayName,
    ]);
    parent = { id: uid, email, name: displayName };
  }

  const token = signToken({ id: parent.id, email: parent.email, name: parent.name });
  return NextResponse.json({ token, parent: { id: parent.id, email: parent.email, name: parent.name } });
}
