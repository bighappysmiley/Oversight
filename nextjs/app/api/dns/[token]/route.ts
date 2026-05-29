import { NextRequest, NextResponse } from 'next/server';
import { db, getDeviceByToken, DEFAULT_SETTINGS } from '@/lib/firestore';

// macOS/iOS managed DoH (com.apple.dnsSettings.managed) uses RFC 8484
// binary DNS-over-HTTPS: queries arrive as GET ?dns=<base64url> or as a
// POST body of Content-Type application/dns-message, and the reply must be
// a binary DNS message. We parse the queried name from the wire format,
// decide block/allow against the device's blocklist, and either synthesize
// an NXDOMAIN response (blocked) or pass the raw query through to Cloudflare.
export const runtime = 'nodejs';

const UPSTREAM = 'https://cloudflare-dns.com/dns-query';

async function getRestrictions(token: string): Promise<{ domains: string[]; mode: string }> {
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

// Canary domains: returning NXDOMAIN for these tells browsers to disable
// their own built-in DNS-over-HTTPS so the system filter takes effect.
// Firefox checks use-application-dns.net; Chrome checks dns.resolver.arpa.
const CANARY_DOMAINS = ['use-application-dns.net', 'dns.resolver.arpa'];

function isBlocked(domain: string, restrictions: { domains: string[]; mode: string }): boolean {
  const q = domain.replace(/\.$/, '').toLowerCase();
  // Always block browser canary domains so built-in DoH is disabled.
  if (CANARY_DOMAINS.some((c) => q === c || q.endsWith('.' + c))) return true;
  const domains = restrictions.domains || [];
  const mode = restrictions.mode || 'blocklist';
  const match = domains.some((d) => q === d || q.endsWith('.' + d));
  return mode === 'blocklist' ? match : (domains.length > 0 && !match);
}

// Parse the QNAME from a binary DNS query (question starts at byte 12).
function parseQuestionName(msg: Buffer): string {
  let offset = 12;
  const labels: string[] = [];
  let guard = 0;
  while (offset < msg.length && guard++ < 128) {
    const len = msg[offset];
    if (len === 0) break;
    // We don't expect compression pointers in a question name.
    if ((len & 0xc0) === 0xc0) break;
    offset += 1;
    if (offset + len > msg.length) break;
    labels.push(msg.subarray(offset, offset + len).toString('ascii'));
    offset += len;
  }
  return labels.join('.');
}

// Build an NXDOMAIN response that echoes the query's header + question.
function buildNxdomain(query: Buffer): Buffer {
  // Find end of question (name + 4 bytes for QTYPE/QCLASS).
  let offset = 12;
  let guard = 0;
  while (offset < query.length && guard++ < 128) {
    const len = query[offset];
    if (len === 0) { offset += 1; break; }
    if ((len & 0xc0) === 0xc0) { offset += 2; break; }
    offset += 1 + len;
  }
  const questionEnd = Math.min(offset + 4, query.length);
  const response = Buffer.from(query.subarray(0, questionEnd));
  // Flags: QR=1, preserve RD; RA=1, RCODE=3 (NXDOMAIN).
  const rd = query.length > 2 ? (query[2] & 0x01) : 0x01;
  response[2] = 0x80 | rd;
  response[3] = 0x83;
  // Counts: QDCOUNT=1, ANCOUNT=NSCOUNT=ARCOUNT=0.
  response[4] = 0x00; response[5] = 0x01;
  response[6] = 0x00; response[7] = 0x00;
  response[8] = 0x00; response[9] = 0x00;
  response[10] = 0x00; response[11] = 0x00;
  return response;
}

async function handleWireQuery(query: Buffer, token: string): Promise<NextResponse> {
  const restrictions = await getRestrictions(token);
  const name = parseQuestionName(query);

  if (name && isBlocked(name, restrictions)) {
    const nx = new Uint8Array(buildNxdomain(query));
    return new NextResponse(nx, {
      headers: {
        'Content-Type': 'application/dns-message',
        'Cache-Control': 'no-store',
      },
    });
  }

  // Allowed — pass the raw query through to Cloudflare unchanged.
  const upstream = await fetch(UPSTREAM, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/dns-message',
      Accept: 'application/dns-message',
    },
    body: new Uint8Array(query),
  });
  const buf = new Uint8Array(await upstream.arrayBuffer());
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/dns-message',
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const { searchParams } = new URL(req.url);

  // RFC 8484 binary path: ?dns=<base64url>
  const dnsParam = searchParams.get('dns');
  if (dnsParam) {
    try {
      const query = Buffer.from(dnsParam.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
      return await handleWireQuery(query, params.token);
    } catch {
      return new NextResponse('bad dns query', { status: 400 });
    }
  }

  // JSON debug path: ?name=example.com (handy for testing in a browser).
  const name = searchParams.get('name');
  if (name) {
    const type = searchParams.get('type') || 'A';
    const restrictions = await getRestrictions(params.token);
    if (isBlocked(name, restrictions)) {
      return NextResponse.json(
        { Status: 3, TC: false, RD: true, RA: true, AD: false, CD: false, Question: [{ name, type: 1 }], Answer: [] },
        { headers: { 'Content-Type': 'application/dns-json' } }
      );
    }
    try {
      const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`;
      const upstream = await fetch(url, { headers: { Accept: 'application/dns-json' } });
      const data = await upstream.text();
      return new NextResponse(data, { headers: { 'Content-Type': 'application/dns-json' } });
    } catch {
      return NextResponse.json({ error: 'DNS upstream failed' }, { status: 502 });
    }
  }

  return new NextResponse('Oversight DNS resolver', { status: 200 });
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const query = Buffer.from(await req.arrayBuffer());
    return await handleWireQuery(query, params.token);
  } catch {
    return new NextResponse('bad dns query', { status: 400 });
  }
}
