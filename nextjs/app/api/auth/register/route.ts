import { NextRequest, NextResponse } from 'next/server';

// Legacy password registration is no longer supported. Authentication is
// handled entirely by Firebase Auth on the client, then exchanged for an app
// JWT at POST /api/auth/firebase.
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: 'Password registration is no longer supported. Sign up with Firebase Auth.' },
    { status: 410 }
  );
}
