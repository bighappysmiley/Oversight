const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function randomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Parent generates a pairing code
router.post('/generate', requireAuth, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });

  const db = getDb();
  // Clean up expired codes
  db.prepare('DELETE FROM pair_codes WHERE expires_at < unixepoch()').run();

  const code = randomCode();
  const expires_at = Math.floor(Date.now() / 1000) + 600; // 10 min

  db.prepare(
    'INSERT INTO pair_codes (code, parent_id, device_name, expires_at) VALUES (?, ?, ?, ?)'
  ).run(code, req.parent.id, name, expires_at);

  res.json({ code, expires_at });
});

// Child device claims a pairing code
router.post('/claim', (req, res) => {
  const { code, device_fingerprint } = req.body;
  if (!code || !device_fingerprint) {
    return res.status(400).json({ error: 'code and device_fingerprint required' });
  }

  const db = getDb();
  const row = db.prepare('SELECT * FROM pair_codes WHERE code = ?').get(code);

  if (!row) return res.status(404).json({ error: 'Invalid pairing code' });
  if (row.claimed_at) return res.status(409).json({ error: 'Code already claimed' });
  if (row.expires_at < Math.floor(Date.now() / 1000)) {
    return res.status(410).json({ error: 'Pairing code expired' });
  }

  const device_id = uuidv4();
  const device_token = uuidv4();

  const create = db.transaction(() => {
    db.prepare(
      'INSERT INTO devices (id, parent_id, name, token) VALUES (?, ?, ?, ?)'
    ).run(device_id, row.parent_id, row.device_name, device_token);

    db.prepare('INSERT INTO settings (device_id) VALUES (?)').run(device_id);

    db.prepare(
      'UPDATE pair_codes SET device_id = ?, claimed_at = unixepoch() WHERE code = ?'
    ).run(device_id, code);
  });
  create();

  res.json({ device_id, device_token });
});

// Parent polls to check if code has been claimed
router.get('/:code/status', requireAuth, (req, res) => {
  const db = getDb();
  const row = db.prepare(
    'SELECT * FROM pair_codes WHERE code = ? AND parent_id = ?'
  ).get(req.params.code, req.parent.id);

  if (!row) return res.status(404).json({ error: 'Code not found' });

  if (row.claimed_at) {
    res.json({ claimed: true, device_id: row.device_id });
  } else {
    res.json({ claimed: false });
  }
});

module.exports = router;
