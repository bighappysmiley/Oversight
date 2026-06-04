import { clearCookieHeader, json, methodNotAllowed } from '../lib/util.js';

export default async (req) => {
  if (req.method !== 'POST') return methodNotAllowed();
  return json({ ok: true }, { headers: { 'Set-Cookie': clearCookieHeader() } });
};

export const config = { path: '/api/logout' };
