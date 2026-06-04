// Shared helpers for the Oversight serverless functions.
//
// Storage uses Netlify Blobs, which is available automatically to functions
// running on Netlify — no external database or credentials required.
import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// Blob stores
// ---------------------------------------------------------------------------
export const stores = {
  accounts: () => getStore('accounts'), // key: email (lowercase) -> account
  accountIds: () => getStore('account-ids'), // key: accountId -> email
  policies: () => getStore('policies'), // key: accountId -> policy
  devices: () => getStore('devices'), // key: `${accountId}:${deviceId}` -> device
  enrollments: () => getStore('enrollments'), // key: code -> enrollment
  deviceTokens: () => getStore('device-tokens'), // key: token -> {accountId, deviceId}
  config: () => getStore('config'), // key: 'secret' -> hmac/encryption secret
};

// ---------------------------------------------------------------------------
// Server secret (auto-generated once, persisted in Blobs unless provided by env)
// ---------------------------------------------------------------------------
let cachedSecret;
export async function getSecret() {
  if (process.env.OVERSIGHT_SECRET) return process.env.OVERSIGHT_SECRET;
  if (cachedSecret) return cachedSecret;
  const store = stores.config();
  let secret = await store.get('secret');
  if (!secret) {
    secret = crypto.randomBytes(32).toString('hex');
    await store.set('secret', secret);
  }
  cachedSecret = secret;
  return secret;
}

// ---------------------------------------------------------------------------
// Password hashing (scrypt) — used for both login and device-protection pwds
// ---------------------------------------------------------------------------
export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password, salt, hash) {
  const test = crypto.scryptSync(String(password), salt, 64).toString('hex');
  const a = Buffer.from(test, 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------------------------------------------------------------------------
// Reversible encryption (AES-256-GCM) for the device-protection password.
// We must be able to recover this value to embed it as the removal password
// inside the iOS configuration profile, so it cannot be a one-way hash.
// ---------------------------------------------------------------------------
function aesKey(secret) {
  return crypto.createHash('sha256').update('oversight-aes:' + secret).digest();
}

export async function encryptSecret(plain) {
  const key = aesKey(await getSecret());
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export async function decryptSecret(b64) {
  const key = aesKey(await getSecret());
  const buf = Buffer.from(b64, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

// ---------------------------------------------------------------------------
// Stateless session tokens (HMAC-signed)
// ---------------------------------------------------------------------------
function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export async function signToken(payload, ttlSeconds = 60 * 60 * 24 * 30) {
  const secret = await getSecret();
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const data = b64url(JSON.stringify(body));
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export async function verifyToken(token) {
  if (!token || !token.includes('.')) return null;
  const secret = await getSecret();
  const [data, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  if (!safeEqual(sig, expected)) return null;
  try {
    const body = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (body.exp && body.exp < Math.floor(Date.now() / 1000)) return null;
    return body;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cookies
// ---------------------------------------------------------------------------
export const COOKIE = 'ov_session';

export function cookieHeader(token, { maxAge = 60 * 60 * 24 * 30 } = {}) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearCookieHeader() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function getCookie(req, name) {
  const header = req.headers.get('cookie') || '';
  const match = header.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

// ---------------------------------------------------------------------------
// Account helpers
// ---------------------------------------------------------------------------
export async function getAccountByEmail(email) {
  if (!email) return null;
  return stores.accounts().get(email.trim().toLowerCase(), { type: 'json' });
}

export async function getAccountById(id) {
  if (!id) return null;
  const email = await stores.accountIds().get(id);
  if (!email) return null;
  return getAccountByEmail(email);
}

export async function saveAccount(account) {
  await stores.accounts().setJSON(account.email.toLowerCase(), account);
  await stores.accountIds().set(account.id, account.email.toLowerCase());
  return account;
}

// Reads the session cookie and returns the authenticated account, or null.
export async function requireAccount(req) {
  const token = getCookie(req, COOKIE);
  const payload = await verifyToken(token);
  if (!payload || !payload.aid) return null;
  return getAccountById(payload.aid);
}

// Strips secret fields before returning an account to the browser.
export function publicAccount(account) {
  if (!account) return null;
  return {
    id: account.id,
    email: account.email,
    createdAt: account.createdAt,
    protectionPasswordSet: !!account.protectionEnc,
  };
}

// ---------------------------------------------------------------------------
// Default content policy
// ---------------------------------------------------------------------------
export function defaultPolicy() {
  return {
    mode: 'auto', // 'auto' | 'blocklist' | 'allowlist'
    filterAdultContent: true,
    safeSearch: true,
    blockSocialMedia: false,
    blockedDomains: [],
    allowedDomains: [],
    blockedCategories: ['adult', 'gambling', 'violence'],
    // App & time controls (enforced by the Android app; iOS needs MDM — see
    // docs/ios-advanced-controls.md).
    blockAppStore: false,
    downtime: { enabled: false, start: '21:00', end: '07:00' },
    blockedApps: [], // package names always blocked
    appLimits: {}, // { "com.package": dailyMinutes }
    updatedAt: new Date().toISOString(),
  };
}

// Policies are stored per device, with an account-level "default" template that
// new devices inherit when they enroll.
export const defaultPolicyKey = (accountId) => `default:${accountId}`;
export const devicePolicyKey = (accountId, deviceId) => `${accountId}:${deviceId}`;

// Returns the effective policy: the device's own policy if set, otherwise the
// account default template, otherwise the hard-coded default.
export async function getPolicy(accountId, deviceId = null) {
  const store = stores.policies();
  if (deviceId) {
    const dp = await store.get(devicePolicyKey(accountId, deviceId), { type: 'json' });
    if (dp) return dp;
  }
  const def = await store.get(defaultPolicyKey(accountId), { type: 'json' });
  return def || defaultPolicy();
}

// Ensures a device has its own policy, copying the account default at first use.
export async function ensureDevicePolicy(accountId, deviceId) {
  const store = stores.policies();
  const key = devicePolicyKey(accountId, deviceId);
  const existing = await store.get(key, { type: 'json' });
  if (existing) return existing;
  const def = (await store.get(defaultPolicyKey(accountId), { type: 'json' })) || defaultPolicy();
  const copy = { ...def, updatedAt: new Date().toISOString() };
  await store.setJSON(key, copy);
  return copy;
}

// Domains we always recommend blocking when "filter adult content" is on.
// Kept short; the BuiltIn iOS filter and category filtering do the heavy
// lifting. Parents can extend the list from the dashboard.
export const SOCIAL_MEDIA_DOMAINS = [
  'tiktok.com',
  'instagram.com',
  'snapchat.com',
  'facebook.com',
  'x.com',
  'twitter.com',
  'reddit.com',
];

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
export function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function methodNotAllowed() {
  return json({ error: 'Method not allowed' }, { status: 405 });
}

export function unauthorized() {
  return json({ error: 'Not signed in' }, { status: 401 });
}

export async function readJson(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

// Short, human-typeable enrollment code (no ambiguous characters).
export function makeCode(length = 8) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export function isValidEmail(email) {
  return typeof email === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}
