import crypto from 'node:crypto';
import {
  stores,
  getAccountByEmail,
  saveAccount,
  hashPassword,
  signToken,
  cookieHeader,
  json,
  readJson,
  methodNotAllowed,
  isValidEmail,
  defaultPolicy,
} from '../lib/util.js';

export default async (req) => {
  if (req.method !== 'POST') return methodNotAllowed();

  const { email, password } = await readJson(req);

  if (!isValidEmail(email)) {
    return json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }
  if (!password || String(password).length < 8) {
    return json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
  }

  const existing = await getAccountByEmail(email);
  if (existing) {
    return json({ error: 'An account with that email already exists.' }, { status: 409 });
  }

  const { salt, hash } = hashPassword(password);
  const account = {
    id: crypto.randomUUID(),
    email: email.trim().toLowerCase(),
    passSalt: salt,
    passHash: hash,
    protectionEnc: null, // device-protection password, set later
    createdAt: new Date().toISOString(),
  };

  await saveAccount(account);
  await stores.policies().setJSON(account.id, defaultPolicy());

  const token = await signToken({ aid: account.id });
  return json(
    { ok: true, account: { id: account.id, email: account.email } },
    { status: 201, headers: { 'Set-Cookie': cookieHeader(token) } }
  );
};

export const config = { path: '/api/signup' };
