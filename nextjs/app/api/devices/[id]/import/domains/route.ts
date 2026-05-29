import { NextRequest, NextResponse } from 'next/server';
import { db, getOwnedDevice, nowSeconds, DEFAULT_SETTINGS } from '@/lib/firestore';
import { getParentFromRequest } from '@/lib/auth';

function cleanDomain(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  let d = raw.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '');
  d = d.replace(/^www\./, '');
  d = d.replace(/\/.*$/, '');
  d = d.trim();
  return d || null;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const parent = getParentFromRequest(req);
  if (!parent) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
    return NextResponse.json({ error: 'Unsupported file type. Use .xlsx, .xls, or .csv' }, { status: 400 });
  }

  const device = await getOwnedDevice(params.id, parent.id);
  if (!device) return NextResponse.json({ error: 'Device not found' }, { status: 404 });

  let workbook: any;
  try {
    const XLSX = require('xlsx');
    const arrayBuffer = await file.arrayBuffer();
    workbook = XLSX.read(Buffer.from(arrayBuffer), { type: 'buffer' });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to parse file: ' + err.message }, { status: 400 });
  }

  const XLSX = require('xlsx');
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const imported: string[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cell = rows[i][0];
    const domain = cleanDomain(String(cell ?? ''));
    if (domain) imported.push(domain);
  }

  const settingsRef = db.collection('settings').doc(device.id);
  const snap = await settingsRef.get();
  const restrictions = (snap.exists && snap.data()?.website_restrictions) || { ...DEFAULT_SETTINGS.website_restrictions };
  const existing = new Set<string>(restrictions.domains || []);
  let added = 0;
  for (const d of imported) {
    if (!existing.has(d)) { existing.add(d); added++; }
  }
  restrictions.domains = Array.from(existing);
  await settingsRef.set({ website_restrictions: restrictions, updated_at: nowSeconds() }, { merge: true });

  return NextResponse.json({ added, total: restrictions.domains.length, domains_preview: restrictions.domains.slice(0, 10) });
}
