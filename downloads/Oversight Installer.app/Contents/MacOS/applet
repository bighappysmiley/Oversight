#!/bin/bash
# Oversight Mac Installer — runs as a GUI app via osascript dialogs.
# When launched from a .app bundle, Finder gives us a minimal PATH, so we
# set a full PATH explicitly and log everything for troubleshooting.

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
SERVER_URL="https://oversight.bhswebsite.org"
LOG="/tmp/oversight-install.log"

echo "=== Oversight install started $(date) ===" > "$LOG"
log() { echo "[$(date '+%H:%M:%S')] $1" >> "$LOG"; }

notify() { osascript -e "display notification \"$1\" with title \"Oversight\"" 2>/dev/null; log "NOTIFY: $1"; }

# Show an error dialog (always visible, unlike notifications) and quit.
fail() {
  log "FAIL: $1"
  osascript -e "display alert \"Installation Failed\" message \"$1\n\nA log was saved to /tmp/oversight-install.log\" as critical buttons {\"OK\"} default button \"OK\"" 2>/dev/null
  exit 1
}

# Welcome
osascript -e 'display dialog "Welcome to Oversight.\n\nThis installs parental controls on this Mac. You will need the 6-digit pairing code from the parent dashboard." with title "Oversight Installer" buttons {"Cancel", "Continue"} default button "Continue" with icon note' 2>/dev/null
[ $? -ne 0 ] && exit 0

# Pairing code
PAIRING_CODE=$(osascript -e 'text returned of (display dialog "Enter the 6-digit pairing code shown in the parent dashboard under Add Device." default answer "" with title "Oversight - Step 1 of 2" buttons {"Cancel", "Install"} default button "Install")' 2>/dev/null)
[ $? -ne 0 ] && exit 0

if ! echo "$PAIRING_CODE" | grep -qE '^[0-9]{6}$'; then
  osascript -e 'display alert "Invalid Code" message "Please enter exactly 6 digits." as critical buttons {"OK"} default button "OK"' 2>/dev/null
  exit 1
fi
log "Pairing code accepted"

notify "Installing Oversight..."

INSTALL_DIR="$HOME/.oversight"
mkdir -p "$INSTALL_DIR" || fail "Could not create the install folder."

# Locate Python 3 — try common locations explicitly (Finder PATH is minimal).
PYBIN=""
for cand in /opt/homebrew/bin/python3 /usr/local/bin/python3 /usr/bin/python3 "$(command -v python3 2>/dev/null)"; do
  if [ -n "$cand" ] && [ -x "$cand" ]; then PYBIN="$cand"; break; fi
done
log "Python: ${PYBIN:-NOT FOUND}"
if [ -z "$PYBIN" ]; then
  fail "Python 3 is required but was not found. Install it from python.org, then run this installer again."
fi

# Install the requests library (best-effort; agent will still try without it).
"$PYBIN" -m pip install requests --quiet --break-system-packages >>"$LOG" 2>&1 \
  || "$PYBIN" -m pip install requests --quiet >>"$LOG" 2>&1 \
  || log "pip install requests failed (continuing)"

# Download the agent
notify "Downloading agent..."
if ! curl -fsSL "$SERVER_URL/api/install/agent.py" -o "$INSTALL_DIR/agent.py" >>"$LOG" 2>&1; then
  fail "Could not reach the Oversight server. Check your internet connection and try again."
fi
log "Agent downloaded"

# Config
cat > "$INSTALL_DIR/config.json" <<JSON
{"server_url": "$SERVER_URL", "device_token": ""}
JSON

# Pair
notify "Pairing with parent account..."
cd "$INSTALL_DIR" || fail "Could not open the install folder."
PAIR_OUT=$("$PYBIN" agent.py --pair-code "$PAIRING_CODE" 2>>"$LOG")
if [ $? -ne 0 ]; then
  log "Pair output: $PAIR_OUT"
  fail "Pairing failed. The code may have expired — generate a new one in the parent dashboard and try again."
fi
log "Paired successfully"

# Background service (needs admin). osascript shows the native password prompt.
notify "Installing background service..."
osascript -e "do shell script \"'$PYBIN' '$INSTALL_DIR/agent.py' --install\" with administrator privileges" >>"$LOG" 2>&1
if [ $? -ne 0 ]; then
  fail "Could not install the background service (admin password needed). Please try again."
fi
log "Service installed"

# Web filter profile
notify "Setting up web filter..."
DEVICE_TOKEN=$("$PYBIN" -c "import json; print(json.load(open('$INSTALL_DIR/config.json')).get('device_token',''))" 2>>"$LOG" || echo "")
PROFILE_URL="$SERVER_URL/api/install/mac-profile"
[ -n "$DEVICE_TOKEN" ] && PROFILE_URL="${PROFILE_URL}?token=${DEVICE_TOKEN}"
PROFILE_PATH="/tmp/oversight.mobileconfig"

if curl -fsSL "$PROFILE_URL" -o "$PROFILE_PATH" >>"$LOG" 2>&1; then
  open "$PROFILE_PATH"
  osascript -e 'display dialog "Almost done!\n\nmacOS opened System Settings. Click \"Install\" and enter your admin password to turn on the web filter.\n\nThis profile cannot be removed without the parent passcode." with title "Oversight - Step 2 of 2" buttons {"Done"} default button "Done" with icon note' 2>/dev/null
else
  log "Profile download failed"
  osascript -e 'display dialog "Oversight is installed and monitoring is active.\n\nThe web filter profile could not be downloaded right now — you can install it later from the parent dashboard." with title "Oversight" buttons {"OK"} default button "OK" with icon note' 2>/dev/null
fi

log "=== Install finished OK ==="
osascript -e 'display dialog "Oversight is now active and protecting this Mac." with title "Oversight" buttons {"Finish"} default button "Finish" with icon note' 2>/dev/null
