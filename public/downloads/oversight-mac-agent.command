#!/bin/bash
# ============================================================
#  Oversight Mac agent — live filtering that syncs.
#
#  Run it from Terminal:
#     bash ~/Downloads/oversight-mac-agent.command
#  Enter your Mac's admin password and the setup code when asked.
#
#  It installs a background service that, every minute, pulls the
#  latest policy from your dashboard and applies it: Safe DNS plus
#  your blocked sites. It runs as root, so a child can't remove it
#  without an admin password.  To uninstall, see the end of this file.
# ============================================================
set -e

SERVER_DEFAULT="https://oversight.netlify.app"
echo "=== Oversight Mac setup ==="
read -r -p "Server URL [$SERVER_DEFAULT]: " SERVER
SERVER="${SERVER:-$SERVER_DEFAULT}"
SERVER="${SERVER%/}"
read -r -p "Setup code (from the dashboard): " CODE
CODE=$(echo "$CODE" | tr '[:lower:]' '[:upper:]' | tr -d ' ')
NAME=$(scutil --get ComputerName 2>/dev/null || echo "Mac")
ENC_NAME=$(echo "$NAME" | sed 's/ /%20/g')

echo "Enrolling this Mac..."
RESP=$(curl -fsS "$SERVER/api/android/config?code=$CODE&platform=macos&name=$ENC_NAME") || {
  echo "Could not reach $SERVER. Check the URL and your connection."; exit 1; }
TOKEN=$(echo "$RESP" | sed -n 's/.*"deviceToken":"\([^"]*\)".*/\1/p')
if [ -z "$TOKEN" ]; then
  echo "Enrollment failed — the code may be wrong or expired (codes last 1 hour)."; exit 1
fi
echo "Enrolled as \"$NAME\"."

echo "Installing the background service (you may be asked for your admin password)..."
sudo mkdir -p /usr/local/etc/oversight /usr/local/bin
printf 'SERVER=%s\nTOKEN=%s\n' "$SERVER" "$TOKEN" | sudo tee /usr/local/etc/oversight/config >/dev/null
sudo chmod 600 /usr/local/etc/oversight/config

sudo tee /usr/local/bin/oversight-agent.sh >/dev/null <<'AGENT'
#!/bin/bash
# Oversight poller — runs as root via launchd every minute.
. /usr/local/etc/oversight/config 2>/dev/null || exit 0
DATA=$(curl -fsS -H "X-Device-Token: $TOKEN" "$SERVER/api/agent/hosts") || exit 0
[ -z "$DATA" ] && exit 0

SAFEDNS=$(echo "$DATA" | head -1 | sed -n 's/.*safedns=\([a-z]*\).*/\1/p')
networksetup -listallnetworkservices | tail -n +2 | sed 's/^\*//' | while IFS= read -r svc; do
  [ -z "$svc" ] && continue
  if [ "$SAFEDNS" = "on" ]; then
    networksetup -setdnsservers "$svc" 1.1.1.3 1.0.0.3 2>/dev/null || true
  else
    networksetup -setdnsservers "$svc" empty 2>/dev/null || true
  fi
done

BODY=$(echo "$DATA" | grep '^0\.0\.0\.0 ' || true)
TMP=$(mktemp)
sed '/# OVERSIGHT START/,/# OVERSIGHT END/d' /etc/hosts > "$TMP"
{
  echo "# OVERSIGHT START"
  echo "$BODY"
  echo "# OVERSIGHT END"
} >> "$TMP"
cat "$TMP" > /etc/hosts
rm -f "$TMP"
dscacheutil -flushcache 2>/dev/null || true
killall -HUP mDNSResponder 2>/dev/null || true
AGENT
sudo chmod +x /usr/local/bin/oversight-agent.sh

sudo tee /Library/LaunchDaemons/com.oversight.agent.plist >/dev/null <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.oversight.agent</string>
  <key>ProgramArguments</key>
  <array><string>/bin/bash</string><string>/usr/local/bin/oversight-agent.sh</string></array>
  <key>RunAtLoad</key><true/>
  <key>StartInterval</key><integer>60</integer>
</dict>
</plist>
PLIST

sudo launchctl unload /Library/LaunchDaemons/com.oversight.agent.plist 2>/dev/null || true
sudo launchctl load -w /Library/LaunchDaemons/com.oversight.agent.plist
sudo /usr/local/bin/oversight-agent.sh || true

echo ""
echo "✓ Oversight is installed and will sync every minute."
echo "  Change settings in your dashboard and this Mac updates automatically."
echo "  You can close this window."

# ------------------------------------------------------------
# To uninstall (requires admin password):
#   sudo launchctl unload /Library/LaunchDaemons/com.oversight.agent.plist
#   sudo rm -f /Library/LaunchDaemons/com.oversight.agent.plist /usr/local/bin/oversight-agent.sh
#   sudo rm -rf /usr/local/etc/oversight
#   sudo sed -i '' '/# OVERSIGHT START/,/# OVERSIGHT END/d' /etc/hosts
#   for s in $(networksetup -listallnetworkservices | tail -n +2 | sed 's/^\*//'); do sudo networksetup -setdnsservers "$s" empty; done
# ------------------------------------------------------------
