import { NextRequest, NextResponse } from 'next/server';
import { db, getDeviceByToken, DEFAULT_SETTINGS } from '@/lib/firestore';

async function getDeviceSettings(token: string) {
  if (!token || token === 'default') return { domains: [], mode: 'blocklist' };
  try {
    const device = await getDeviceByToken(token);
    if (!device) return { domains: [], mode: 'blocklist' };
    const snap = await db.collection('settings').doc(device.id).get();
    if (!snap.exists) return { domains: [], mode: 'blocklist' };
    return snap.data()?.website_restrictions || { ...DEFAULT_SETTINGS.website_restrictions };
  } catch {
    return { domains: [], mode: 'blocklist' };
  }
}

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get('name') || '';
  const type = searchParams.get('type') || 'A';

  const restrictions = await getDeviceSettings(params.token);
  const domains: string[] = restrictions.domains || [];
  const mode: string = restrictions.mode || 'blocklist';
  const queryDomain = name.replace(/\.$/, '').toLowerCase();
  const match = domains.some((d: string) => queryDomain === d || queryDomain.endsWith('.' + d));
  const blocked = mode === 'blocklist' ? match : (domains.length > 0 && !match);

  if (blocked) {
    return NextResponse.json({
      Status: 3, TC: false, RD: true, RA: true, AD: false, CD: false,
      Question: [{ name, type: 1 }],
      Answer: [],
    }, { headers: { 'Content-Type': 'application/dns-json' } });
  }

  // Forward to Cloudflare DoH
  try {
    const url = `https://1.1.1.1/dns-query?name=${encodeURIComponent(name)}&type=${type}`;
    const upstream = await fetch(url, { headers: { Accept: 'application/dns-json' } });
    const data = await upstream.text();
    return new NextResponse(data, {
      headers: { 'Content-Type': 'application/dns-json' },
    });
  } catch {
    return NextResponse.json({ error: 'DNS upstream failed' }, { status: 502 });
  }
}
