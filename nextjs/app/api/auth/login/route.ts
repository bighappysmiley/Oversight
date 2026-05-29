import { NextRequest, NextResponse } from 'next/server';

// Legacy password login is no longer supported. Authentication is handled
// entirely by Firebase Auth on the client, then exchanged for an app JWT at
// POST /api/auth/firebase.
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: 'Password login is no longer supported. Sign in with Firebase Auth.' },
    { status: 410 }
  );
}
