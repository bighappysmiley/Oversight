#!/bin/bash
# Oversight Mac installer — run as root by the Oversight app (via the standard
# macOS admin-password prompt). Args: <serverURL> <setupCode>
# Enrolls the Mac, then installs a LaunchDaemon that syncs the policy every
# minute (Safe DNS + blocked sites).
set -e

SERVER="${1%/}"
CODE=$(printf %s "$2" | tr '[:lower:]' '[:upper:]' | tr -d ' ')
[ -z "$SERVER" ] && { echo "Missing server address." >&2; exit 1; }
[ -z "$CODE" ] && { echo "Missing setup code." >&2; exit 1; }

NAME=$(scutil --get ComputerName 2>/dev/null || echo "Mac")
ENC=$(printf %s "$NAME" | sed 's/ /%20/g')

RESP=$(curl -fsS "$SERVER/api/android/config?code=$CODE&platform=macos&name=$ENC") \
  || { echo "Could not reach $SERVER. Check the address and your internet connection." >&2; exit 1; }
TOKEN=$(printf %s "$RESP" | sed -n 's/.*"deviceToken":"\([^"]*\)".*/\1/p')
[ -z "$TOKEN" ] && { echo "That setup code is invalid or expired (codes last 1 hour)." >&2; exit 1; }

mkdir -p /usr/local/etc/oversight /usr/local/bin
printf 'SERVER=%s\nTOKEN=%s\n' "$SERVER" "$TOKEN" > /usr/local/etc/oversight/config
chmod 600 /usr/local/etc/oversight/config

cat > /usr/local/bin/oversight-agent.sh <<'AGENT'
#!/bin/bash
. /usr/local/etc/oversight/config 2>/dev/null || exit 0
DATA=$(curl -fsS -H "X-Device-Token: $TOKEN" "$SERVER/api/agent/hosts") || exit 0
[ -z "$DATA" ] && exit 0
SAFEDNS=$(printf %s "$DATA" | head -1 | sed -n 's/.*safedns=\([a-z]*\).*/\1/p')
networksetup -listallnetworkservices | tail -n +2 | sed 's/^\*//' | while IFS= read -r svc; do
  [ -z "$svc" ] && continue
  if [ "$SAFEDNS" = "on" ]; then
    networksetup -setdnsservers "$svc" 1.1.1.3 1.0.0.3 2>/dev/null || true
  else
    networksetup -setdnsservers "$svc" empty 2>/dev/null || true
  fi
done
BODY=$(printf %s "$DATA" | grep '^0\.0\.0\.0 ' || true)
TMP=$(mktemp)
sed '/# OVERSIGHT START/,/# OVERSIGHT END/d' /etc/hosts > "$TMP"
{ echo "# OVERSIGHT START"; echo "$BODY"; echo "# OVERSIGHT END"; } >> "$TMP"
cat "$TMP" > /etc/hosts
rm -f "$TMP"
dscacheutil -flushcache 2>/dev/null || true
killall -HUP mDNSResponder 2>/dev/null || true
AGENT
chmod +x /usr/local/bin/oversight-agent.sh

cat > /Library/LaunchDaemons/com.oversight.agent.plist <<'PLIST'
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

launchctl unload /Library/LaunchDaemons/com.oversight.agent.plist 2>/dev/null || true
launchctl load -w /Library/LaunchDaemons/com.oversight.agent.plist
/usr/local/bin/oversight-agent.sh || true
echo "Oversight installed."
