const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');
const { requireAuth, requireDeviceAuth } = require('../middleware/auth');

const router = express.Router();

// Agent routes MUST come before /:id routes to avoid being swallowed by the param matcher

// Agent: pull settings (device authenticates with token)
router.get('/agent/settings', requireDeviceAuth, (req, res) => {
  const db = getDb();
  const settings = db.prepare('SELECT * FROM settings WHERE device_id = ?').get(req.device.id);
  if (!settings) return res.status(404).json({ error: 'Settings not found' });
  res.json({
    app_limits: JSON.parse(settings.app_limits),
    downtime: JSON.parse(settings.downtime),
    website_restrictions: JSON.parse(settings.website_restrictions),
    updated_at: settings.updated_at,
  });
});

// Agent: push usage data
router.post('/agent/usage', requireDeviceAuth, (req, res) => {
  const { app_usage, web_usage, date } = req.body;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date required in YYYY-MM-DD format' });
  }
  const db = getDb();

  const upsertApp = db.prepare(`INSERT INTO usage_logs (device_id, app_name, bundle_id, duration_seconds, date)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(device_id, app_name, date) DO UPDATE SET
      duration_seconds = MAX(duration_seconds, excluded.duration_seconds)`);

  const upsertWeb = db.prepare(`INSERT INTO web_logs (device_id, domain, visits, date)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(device_id, domain, date) DO UPDATE SET
      visits = MAX(visits, excluded.visits)`);

  const insertMany = db.transaction(() => {
    for (const entry of (app_usage || [])) {
      upsertApp.run(req.device.id, entry.app_name, entry.bundle_id || null, entry.duration_seconds, date);
    }
    for (const entry of (web_usage || [])) {
      upsertWeb.run(req.device.id, entry.domain, entry.visits || 1, date);
    }
  });
  insertMany();
  res.json({ ok: true });
});

// Parent: list their devices
router.get('/', requireAuth, (req, res) => {
  const devices = getDb()
    .prepare('SELECT id, name, last_seen, created_at FROM devices WHERE parent_id = ?')
    .all(req.parent.id);
  res.json({ devices });
});

// Parent: register a new child device (returns token for agent)
router.post('/', requireAuth, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const db = getDb();
  const id = uuidv4();
  const token = uuidv4();
  db.prepare('INSERT INTO devices (id, parent_id, name, token) VALUES (?, ?, ?, ?)').run(id, req.parent.id, name, token);
  db.prepare('INSERT INTO settings (device_id) VALUES (?)').run(id);
  res.json({ device: { id, name, token } });
});

// Parent: delete device
router.delete('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const device = db.prepare('SELECT * FROM devices WHERE id = ? AND parent_id = ?').get(req.params.id, req.parent.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  db.prepare('DELETE FROM usage_logs WHERE device_id = ?').run(device.id);
  db.prepare('DELETE FROM web_logs WHERE device_id = ?').run(device.id);
  db.prepare('DELETE FROM settings WHERE device_id = ?').run(device.id);
  db.prepare('DELETE FROM devices WHERE id = ?').run(device.id);
  res.json({ ok: true });
});

// Parent: get settings for a device
router.get('/:id/settings', requireAuth, (req, res) => {
  const db = getDb();
  const device = db.prepare('SELECT * FROM devices WHERE id = ? AND parent_id = ?').get(req.params.id, req.parent.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  const settings = db.prepare('SELECT * FROM settings WHERE device_id = ?').get(device.id);
  if (!settings) return res.status(404).json({ error: 'Settings not found' });
  res.json({
    app_limits: JSON.parse(settings.app_limits),
    downtime: JSON.parse(settings.downtime),
    website_restrictions: JSON.parse(settings.website_restrictions),
    updated_at: settings.updated_at,
  });
});

// Parent: update settings for a device
router.put('/:id/settings', requireAuth, (req, res) => {
  const db = getDb();
  const device = db.prepare('SELECT * FROM devices WHERE id = ? AND parent_id = ?').get(req.params.id, req.parent.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  const { app_limits, downtime, website_restrictions } = req.body;
  const current = db.prepare('SELECT * FROM settings WHERE device_id = ?').get(device.id);
  db.prepare(`UPDATE settings SET
    app_limits = ?,
    downtime = ?,
    website_restrictions = ?,
    updated_at = unixepoch()
    WHERE device_id = ?`).run(
    JSON.stringify(app_limits ?? JSON.parse(current.app_limits)),
    JSON.stringify(downtime ?? JSON.parse(current.downtime)),
    JSON.stringify(website_restrictions ?? JSON.parse(current.website_restrictions)),
    device.id
  );
  res.json({ ok: true });
});

// Parent: get usage data for a device
router.get('/:id/usage', requireAuth, (req, res) => {
  const db = getDb();
  const device = db.prepare('SELECT * FROM devices WHERE id = ? AND parent_id = ?').get(req.params.id, req.parent.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });

  const { from, to } = req.query;
  const fromDate = from || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const toDate = to || new Date().toISOString().slice(0, 10);

  const appUsage = db.prepare(
    `SELECT app_name, bundle_id, SUM(duration_seconds) as total_seconds, date
     FROM usage_logs WHERE device_id = ? AND date >= ? AND date <= ?
     GROUP BY app_name, bundle_id, date ORDER BY date, total_seconds DESC`
  ).all(device.id, fromDate, toDate);

  const webUsage = db.prepare(
    `SELECT domain, SUM(visits) as total_visits, date
     FROM web_logs WHERE device_id = ? AND date >= ? AND date <= ?
     GROUP BY domain, date ORDER BY date, total_visits DESC`
  ).all(device.id, fromDate, toDate);

  res.json({ app_usage: appUsage, web_usage: webUsage });
});

module.exports = router;
