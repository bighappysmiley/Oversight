import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  const filePath = path.join(process.cwd(), 'public', 'downloads', 'agent_linux.py');
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'File not available yet' }, { status: 404 });
  }
  const data = fs.readFileSync(filePath);
  return new NextResponse(data, {
    headers: {
      'Content-Type': 'text/plain',
      'Content-Disposition': 'attachment; filename="agent_linux.py"',
    },
  });
}
