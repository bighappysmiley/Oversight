import { NextRequest, NextResponse } from 'next/server';

const REMOVAL_PASSWORD = 'Oversightremoval67843!#bhs2819';

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token') || 'default';
  const dohUrl = `https://oversight.bhswebsite.org/api/dns/${token}`;
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
  <key>PayloadRemovalDisallowed</key>
  <true/>
  <key>RemovalPassword</key>
  <string>${REMOVAL_PASSWORD}</string>
  <key>ConsentText</key>
  <dict>
    <key>default</key>
    <string>This profile installs parental controls managed by your parent or guardian. Removing it requires a passcode.</string>
  </dict>
</dict>
</plist>`;

  return new NextResponse(profile, {
    headers: {
      'Content-Type': 'application/x-apple-aspen-config',
      'Content-Disposition': 'attachment; filename="oversight.mobileconfig"',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
