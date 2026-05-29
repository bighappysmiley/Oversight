import { NextRequest, NextResponse } from 'next/server';
import { db, auth, nowSeconds } from '@/lib/firestore';
import { signToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { idToken, name: nameParam } = await req.json();
  if (!idToken) {
    return NextResponse.json({ error: 'idToken required' }, { status: 400 });
  }

  // Verify the Firebase ID token using the Admin SDK
  let uid: string;
  let email: string;
  let displayName: string;
  try {
    const decoded = await auth.verifyIdToken(idToken);
    uid = decoded.uid;
    email = decoded.email || '';
    displayName = (decoded as any).name || nameParam || (email ? email.split('@')[0] : 'Parent');
  } catch {
    return NextResponse.json({ error: 'Invalid Firebase token' }, { status: 401 });
  }

  // Upsert parent record keyed by Firebase UID
  const ref = db.collection('parents').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({ email, name: displayName, created_at: nowSeconds() });
  }
  const parent = { id: uid, email, name: displayName };

  const token = signToken({ id: parent.id, email: parent.email, name: parent.name });
  return NextResponse.json({ token, parent });
}
