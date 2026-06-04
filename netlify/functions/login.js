import {
  getAccountByEmail,
  verifyPassword,
  signToken,
  cookieHeader,
  json,
  readJson,
  methodNotAllowed,
} from '../lib/util.js';

export default async (req) => {
  if (req.method !== 'POST') return methodNotAllowed();

  const { email, password } = await readJson(req);
  const account = await getAccountByEmail(email);

  // Constant-ish response whether or not the account exists.
  if (!account || !verifyPassword(password, account.passSalt, account.passHash)) {
    return json({ error: 'Incorrect email or password.' }, { status: 401 });
  }

  const token = await signToken({ aid: account.id });
  return json(
    { ok: true, account: { id: account.id, email: account.email } },
    { status: 200, headers: { 'Set-Cookie': cookieHeader(token) } }
  );
};

export const config = { path: '/api/login' };
