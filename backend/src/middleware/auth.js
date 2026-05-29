const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'oversight-dev-secret-change-in-prod';

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }
  try {
    req.parent = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function requireDeviceAuth(req, res, next) {
  const token = req.headers['x-device-token'];
  if (!token) return res.status(401).json({ error: 'Missing device token' });
  const { getDb } = require('../db/schema');
  const device = getDb().prepare('SELECT * FROM devices WHERE token = ?').get(token);
  if (!device) return res.status(401).json({ error: 'Unknown device' });
  req.device = device;
  getDb().prepare('UPDATE devices SET last_seen = unixepoch() WHERE id = ?').run(device.id);
  next();
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

module.exports = { requireAuth, requireDeviceAuth, signToken };
