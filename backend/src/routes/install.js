const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const { getDb } = require('../db/schema');

const REMOVAL_PASSWORD = 'Oversightremoval67843!#bhs2819';

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function getDeviceSettings(token) {
  if (!token) return { domains: [], mode: 'blocklist' };
  const db = getDb();
  const device = db.prepare('SELECT * FROM devices WHERE token = ?').get(token);
  if (!device) return { domains: [], mode: 'blocklist' };
  const settings = db.prepare('SELECT * FROM settings WHERE device_id = ?').get(device.id);
  if (!settings) return { domains: [], mode: 'blocklist' };
  try {
    return JSON.parse(settings.website_restrictions);
  } catch {
    return { domains: [], mode: 'blocklist' };
  }
}

function buildServerBase(req) {
  const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
  return `${proto}://${req.headers.host}`;
}

// ── macOS Configuration Profile ──────────────────────────────────────────────
// GET /api/install/mac-profile?token=<device_token>
// Returns a .mobileconfig that:
//   • Installs Oversight DNS filtering (DoH)
//   • Requires the removal passcode to remove from System Settings
//   • Sets PayloadScope to System (applies to all users on the Mac)
router.get('/mac-profile', (req, res) => {
  const { token } = req.query;
  const base = buildServerBase(req);
  const dohUrl = `${base}/api/dns/${token || 'default'}`;
  const ts = Date.now();

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
          <string>1.0.0.1</string>
        </array>
      </dict>
      <key>PayloadDescription</key>
      <string>Routes DNS through Oversight to enforce website restrictions.</string>
      <key>PayloadDisplayName</key>
      <string>Oversight Web Filter</string>
      <key>PayloadIdentifier</key>
      <string>com.oversight.dns.${ts}</string>
      <key>PayloadType</key>
      <string>com.apple.dnsSettings.managed</string>
      <key>PayloadUUID</key>
      <string>${generateUUID()}</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
    </dict>
  </array>

  <key>PayloadDescription</key>
  <string>Oversight parental controls — DNS web filter. Managed by your parent.</string>
  <key>PayloadDisplayName</key>
  <string>Oversight Parental Controls</string>
  <key>PayloadIdentifier</key>
  <string>com.oversight.mac.profile</string>
  <key>PayloadOrganization</key>
  <string>Oversight by BigHappySmiley</string>
  <key>PayloadScope</key>
  <string>System</string>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>${generateUUID()}</string>
  <key>PayloadVersion</key>
  <integer>1</integer>

  <!-- Require passcode to remove this profile -->
  <key>PayloadRemovalDisallowed</key>
  <false/>
  <key>RemovalPassword</key>
  <string>${REMOVAL_PASSWORD}</string>

  <key>ConsentText</key>
  <dict>
    <key>default</key>
    <string>This profile installs parental controls managed by your parent or guardian. Removing it requires a passcode.</string>
  </dict>
</dict>
</plist>`;

  res.set('Content-Type', 'application/x-apple-aspen-config');
  res.set('Content-Disposition', 'attachment; filename="oversight.mobileconfig"');
  res.send(profile);
});

// ── iOS Configuration Profile ─────────────────────────────────────────────────
// GET /api/install/ios-profile?token=<device_token>
router.get('/ios-profile', (req, res) => {
  const { token } = req.query;
  const base = buildServerBase(req);
  const dohUrl = `${base}/api/dns/${token || 'default'}`;
  const ts = Date.now();

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
          <string>1.0.0.1</string>
        </array>
      </dict>
      <key>PayloadDescription</key>
      <string>Routes DNS through Oversight to enforce website restrictions.</string>
      <key>PayloadDisplayName</key>
      <string>Oversight Web Filter</string>
      <key>PayloadIdentifier</key>
      <string>com.oversight.dns.ios.${ts}</string>
      <key>PayloadType</key>
      <string>com.apple.dnsSettings.managed</string>
      <key>PayloadUUID</key>
      <string>${generateUUID()}</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
    </dict>
  </array>

  <key>PayloadDescription</key>
  <string>Oversight parental controls — DNS web filter. Managed by your parent.</string>
  <key>PayloadDisplayName</key>
  <string>Oversight Parental Controls</string>
  <key>PayloadIdentifier</key>
  <string>com.oversight.ios.profile</string>
  <key>PayloadOrganization</key>
  <string>Oversight by BigHappySmiley</string>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>${generateUUID()}</string>
  <key>PayloadVersion</key>
  <integer>1</integer>

  <!-- Require passcode to remove this profile -->
  <key>PayloadRemovalDisallowed</key>
  <false/>
  <key>RemovalPassword</key>
  <string>${REMOVAL_PASSWORD}</string>

  <key>ConsentText</key>
  <dict>
    <key>default</key>
    <string>This profile installs parental controls managed by your parent or guardian. Removing it requires a passcode.</string>
  </dict>
</dict>
</plist>`;

  res.set('Content-Type', 'application/x-apple-aspen-config');
  res.set('Content-Disposition', 'attachment; filename="oversight-ios.mobileconfig"');
  res.send(profile);
});

// ── DNS-over-HTTPS resolver ───────────────────────────────────────────────────
// GET /api/dns/:token?name=example.com&type=A
router.get('/dns/:token', (req, res) => {
  const { token } = req.params;
  const { name, type } = req.query;

  const restrictions = getDeviceSettings(token);
  const domains = restrictions.domains || [];
  const mode = restrictions.mode || 'blocklist';
  const queryDomain = (name || '').replace(/\.$/, '').toLowerCase();
  const match = domains.some(d => queryDomain === d || queryDomain.endsWith('.' + d));
  const blocked = mode === 'blocklist' ? match : (domains.length > 0 && !match);

  if (blocked) {
    res.set('Content-Type', 'application/dns-json');
    return res.json({
      Status: 3, TC: false, RD: true, RA: true, AD: false, CD: false,
      Question: [{ name, type: 1 }],
      Answer: [],
    });
  }

  // Forward to Cloudflare DoH
  const https = require('https');
  const url = `https://1.1.1.1/dns-query?name=${encodeURIComponent(name || '')}&type=${type || 'A'}`;
  https.get(url, { headers: { Accept: 'application/dns-json' } }, (upstream) => {
    let data = '';
    upstream.on('data', d => data += d);
    upstream.on('end', () => {
      res.set('Content-Type', 'application/dns-json');
      res.send(data);
    });
  }).on('error', () => res.status(502).json({ error: 'DNS upstream failed' }));
});

// ── Static file downloads ─────────────────────────────────────────────────────
function serveFile(filePath, downloadName, contentType) {
  return (req, res) => {
    if (fs.existsSync(filePath)) {
      res.set('Content-Type', contentType || 'application/octet-stream');
      res.set('Content-Disposition', `attachment; filename="${downloadName}"`);
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: 'File not available yet' });
    }
  };
}

const AGENT_DIR = path.join(__dirname, '../../../mac-agent');
const DOWNLOADS_DIR = path.join(__dirname, '../../../downloads');

router.get('/agent.py',         serveFile(path.join(AGENT_DIR, 'agent.py'),         'agent.py',         'text/plain'));
router.get('/agent_windows.py', serveFile(path.join(AGENT_DIR, 'agent_windows.py'), 'agent_windows.py', 'text/plain'));
router.get('/agent_linux.py',   serveFile(path.join(AGENT_DIR, 'agent_linux.py'),   'agent_linux.py',   'text/plain'));

// Installer downloads — served via /api/install/ so they work in production without extra server config
router.get('/mac',     serveFile(path.join(DOWNLOADS_DIR, 'oversight-mac.command'), 'oversight-mac.command', 'application/octet-stream'));
router.get('/windows', serveFile(path.join(DOWNLOADS_DIR, 'oversight-windows.bat'), 'oversight-windows.bat', 'application/octet-stream'));
router.get('/linux',   serveFile(path.join(DOWNLOADS_DIR, 'oversight-linux.sh'),    'oversight-linux.sh',    'application/octet-stream'));

module.exports = router;
