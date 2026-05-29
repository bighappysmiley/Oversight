import { NextRequest, NextResponse } from 'next/server';
import { getParentFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const parent = getParentFromRequest(req);
  if (!parent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ parent });
}
