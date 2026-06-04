import {
  requireAccount,
  saveAccount,
  publicAccount,
  encryptSecret,
  json,
  readJson,
  unauthorized,
  methodNotAllowed,
} from '../lib/util.js';

export default async (req) => {
  const account = await requireAccount(req);
  if (!account) return unauthorized();

  if (req.method === 'GET') {
    return json({ account: publicAccount(account) });
  }

  // PUT: set or change the device-protection password. This is the password a
  // child must enter to remove the iOS profile or uninstall the Android app.
  if (req.method === 'PUT') {
    const { protectionPassword } = await readJson(req);
    if (!protectionPassword || String(protectionPassword).length < 4) {
      return json(
        { error: 'The device-protection password must be at least 4 characters.' },
        { status: 400 }
      );
    }
    account.protectionEnc = await encryptSecret(String(protectionPassword));
    await saveAccount(account);
    return json({ ok: true, account: publicAccount(account) });
  }

  return methodNotAllowed();
};

export const config = { path: '/api/account' };
