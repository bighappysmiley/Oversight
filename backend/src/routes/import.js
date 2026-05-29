const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const { getDb } = require('../db/schema');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

function cleanDomain(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let d = raw.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '');
  d = d.replace(/^www\./, '');
  d = d.replace(/\/.*$/, '');
  d = d.trim();
  return d || null;
}

router.post('/:id/import/domains', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const ext = (req.file.originalname || '').split('.').pop().toLowerCase();
  if (!['xlsx', 'xls', 'csv'].includes(ext)) {
    return res.status(400).json({ error: 'Unsupported file type. Use .xlsx, .xls, or .csv' });
  }

  const db = getDb();
  const device = db.prepare('SELECT * FROM devices WHERE id = ? AND parent_id = ?').get(req.params.id, req.parent.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });

  let workbook;
  try {
    workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
  } catch (err) {
    return res.status(400).json({ error: 'Failed to parse file: ' + err.message });
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Skip header row (index 0)
  const imported = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const cell = row[0];
    const domain = cleanDomain(String(cell ?? ''));
    if (domain) imported.push(domain);
  }

  const settings = db.prepare('SELECT * FROM settings WHERE device_id = ?').get(device.id);
  const restrictions = JSON.parse(settings.website_restrictions);
  const existing = new Set(restrictions.domains || []);
  let added = 0;
  for (const d of imported) {
    if (!existing.has(d)) {
      existing.add(d);
      added++;
    }
  }
  restrictions.domains = Array.from(existing);

  db.prepare(`UPDATE settings SET website_restrictions = ?, updated_at = unixepoch() WHERE device_id = ?`)
    .run(JSON.stringify(restrictions), device.id);

  res.json({
    added,
    total: restrictions.domains.length,
    domains_preview: restrictions.domains.slice(0, 10),
  });
});

module.exports = router;
