const express = require('express');
const router = express.Router();
const { getDb } = require('../db/schema');

// Serve iOS DNS configuration profile
// GET /api/install/ios-profile?token=<device_token>
router.get('/ios-profile', (req, res) => {
  const { token } = req.query;

  // Look up device to get its blocked domains
  const db = getDb();
  let domains = [];

  if (token) {
    const device = db.prepare('SELECT * FROM devices WHERE token = ?').get(token);
    if (device) {
      const settings = db.prepare('SELECT * FROM settings WHERE device_id = ?').get(device.id);
      if (settings) {
        try {
          const restrictions = JSON.parse(settings.website_restrictions);
          domains = restrictions.domains || [];
        } catch (e) {
          domains = [];
        }
      }
    }
  }

  // Build DNS-over-HTTPS profile
  const serverHost = req.hostname;
  const dohUrl = `https://${serverHost}/api/dns/${token || 'default'}`;

  const profile = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>DNSSettings</key>
      <dict>
        <key>DNSProtocol</key>
        <string>HTTPS</string>
        <key>ServerURL</key>
        <string>${dohUrl}</string>
        <key>ServerAddresses</key>
        <array>
          <string>1.1.1.1</string>
          <string>8.8.8.8</string>
        </array>
      </dict>
      <key>PayloadDescription</key>
      <string>Oversight DNS Filter</string>
      <key>PayloadDisplayName</key>
      <string>Oversight Web Filter</string>
      <key>PayloadIdentifier</key>
      <string>com.oversight.dns.${Date.now()}</string>
      <key>PayloadType</key>
      <string>com.apple.dnsSettings.managed</string>
      <key>PayloadUUID</key>
      <string>${generateUUID()}</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
    </dict>
  </array>
  <key>PayloadDescription</key>
  <string>Configures Oversight parental control DNS filtering on this device.</string>
  <key>PayloadDisplayName</key>
  <string>Oversight Parental Controls</string>
  <key>PayloadIdentifier</key>
  <string>com.oversight.profile.${Date.now()}</string>
  <key>PayloadRemovalDisallowed</key>
  <false/>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>${generateUUID()}</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>`;

  res.set('Content-Type', 'application/x-apple-aspen-config');
  res.set('Content-Disposition', 'attachment; filename="oversight.mobileconfig"');
  res.send(profile);
});

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// GET /api/dns/:token?name=example.com&type=A
router.get('/dns/:token', (req, res) => {
  const { token } = req.params;
  const { name, type } = req.query;

  const db = getDb();
  const device = db.prepare('SELECT * FROM devices WHERE token = ?').get(token);

  let blocked = false;
  if (device) {
    const settings = db.prepare('SELECT * FROM settings WHERE device_id = ?').get(device.id);
    if (settings) {
      try {
        const restrictions = JSON.parse(settings.website_restrictions);
        const domains = restrictions.domains || [];
        const mode = restrictions.mode || 'blocklist';
        const queryDomain = (name || '').replace(/\.$/, '').toLowerCase();
        const match = domains.some(d => queryDomain === d || queryDomain.endsWith('.' + d));
        blocked = mode === 'blocklist' ? match : (domains.length > 0 && !match);
      } catch (e) {
        blocked = false;
      }
    }
  }

  if (blocked) {
    res.set('Content-Type', 'application/dns-json');
    res.json({ Status: 3, TC: false, RD: true, RA: true, AD: false, CD: false, Question: [{ name, type: 1 }], Answer: [] });
  } else {
    const https = require('https');
    const url = `https://1.1.1.1/dns-query?name=${encodeURIComponent(name || '')}&type=${type || 'A'}`;
    https.get(url, { headers: { Accept: 'application/dns-json' } }, (upstream) => {
      let data = '';
      upstream.on('data', d => data += d);
      upstream.on('end', () => {
        res.set('Content-Type', 'application/dns-json');
        res.send(data);
      });
    }).on('error', () => {
      res.status(502).json({ error: 'DNS upstream failed' });
    });
  }
});

// Serve agent files for download
router.get('/agent.py', (req, res) => {
  const path = require('path');
  const fs = require('fs');
  const file = path.join(__dirname, '../../../mac-agent/agent.py');
  if (fs.existsSync(file)) {
    res.set('Content-Type', 'text/plain');
    res.set('Content-Disposition', 'attachment; filename="agent.py"');
    res.sendFile(file);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

router.get('/agent_windows.py', (req, res) => {
  const path = require('path');
  const fs = require('fs');
  const file = path.join(__dirname, '../../../mac-agent/agent_windows.py');
  if (fs.existsSync(file)) {
    res.set('Content-Type', 'text/plain');
    res.set('Content-Disposition', 'attachment; filename="agent_windows.py"');
    res.sendFile(file);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

module.exports = router;
