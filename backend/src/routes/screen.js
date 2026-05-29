const express = require('express');
const { getDb } = require('../db/schema');
const { requireAuth, requireDeviceAuth } = require('../middleware/auth');

const router = express.Router();

// Agent: POST a new screen frame
router.post('/agent/screen', requireDeviceAuth, (req, res) => {
  const { frame, captured_at } = req.body;
  if (!frame || !captured_at) {
    return res.status(400).json({ error: 'frame and captured_at required' });
  }
  const db = getDb();
  db.prepare(`
    INSERT INTO screen_frames (device_id, frame_data, captured_at, streaming_enabled)
    VALUES (?, ?, ?, 1)
    ON CONFLICT(device_id) DO UPDATE SET
      frame_data = excluded.frame_data,
      captured_at = excluded.captured_at
  `).run(req.device.id, frame, captured_at);
  res.json({ ok: true });
});

// Agent: check if streaming is enabled
router.get('/agent/screen/enabled', requireDeviceAuth, (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT streaming_enabled FROM screen_frames WHERE device_id = ?').get(req.device.id);
  res.json({ enabled: row ? row.streaming_enabled === 1 : false });
});

// Parent: get latest screen frame for a device
router.get('/:id/screen', requireAuth, (req, res) => {
  const db = getDb();
  const device = db.prepare('SELECT * FROM devices WHERE id = ? AND parent_id = ?').get(req.params.id, req.parent.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });

  const row = db.prepare('SELECT * FROM screen_frames WHERE device_id = ?').get(device.id);
  if (!row) return res.status(404).json({ error: 'No frame yet' });

  res.json({
    frame: row.frame_data,
    captured_at: row.captured_at,
    streaming_enabled: row.streaming_enabled === 1,
  });
});

// Parent: toggle streaming on/off
router.put('/:id/screen/toggle', requireAuth, (req, res) => {
  const { enabled } = req.body;
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled (boolean) required' });
  }
  const db = getDb();
  const device = db.prepare('SELECT * FROM devices WHERE id = ? AND parent_id = ?').get(req.params.id, req.parent.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });

  const existing = db.prepare('SELECT * FROM screen_frames WHERE device_id = ?').get(device.id);
  if (existing) {
    db.prepare('UPDATE screen_frames SET streaming_enabled = ? WHERE device_id = ?').run(enabled ? 1 : 0, device.id);
  } else {
    // Create a placeholder row so the agent can poll
    db.prepare(
      'INSERT INTO screen_frames (device_id, frame_data, captured_at, streaming_enabled) VALUES (?, ?, ?, ?)'
    ).run(device.id, '', Math.floor(Date.now() / 1000), enabled ? 1 : 0);
  }
  res.json({ ok: true, streaming_enabled: enabled });
});

module.exports = router;
