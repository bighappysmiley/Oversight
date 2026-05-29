const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');
const { signToken, requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'email, password, name required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  const db = getDb();
  if (db.prepare('SELECT id FROM parents WHERE email = ?').get(email)) {
    return res.status(409).json({ error: 'Email already registered' });
  }
  const hash = await bcrypt.hash(password, 12);
  const id = uuidv4();
  db.prepare('INSERT INTO parents (id, email, password_hash, name) VALUES (?, ?, ?, ?)').run(id, email, hash, name);
  const token = signToken({ id, email, name });
  res.json({ token, parent: { id, email, name } });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const db = getDb();
  const parent = db.prepare('SELECT * FROM parents WHERE email = ?').get(email);
  if (!parent) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, parent.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = signToken({ id: parent.id, email: parent.email, name: parent.name });
  res.json({ token, parent: { id: parent.id, email: parent.email, name: parent.name } });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ parent: req.parent });
});

router.post('/waitlist', (req, res) => {
  const { email, platform } = req.body;
  if (!email || !platform) {
    return res.status(400).json({ error: 'email and platform required' });
  }
  const db = getDb();
  db.prepare('INSERT INTO waitlist (email, platform) VALUES (?, ?)').run(email, platform);
  res.json({ ok: true });
});

module.exports = router;
