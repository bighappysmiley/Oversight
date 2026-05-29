#!/bin/bash
SERVER_URL="https://oversight.bhswebsite.org"
cd "$(dirname "$0")"

# Welcome
osascript -e 'display dialog "Welcome to Oversight.\n\nThis will install parental controls on this Mac. You will need the 6-digit pairing code from the parent dashboard." with title "Oversight Installer" buttons {"Cancel", "Continue"} default button "Continue" with icon note'
[ $? -ne 0 ] && exit 0

# Get pairing code
PAIRING_CODE=$(osascript -e 'text returned of (display dialog "Enter the 6-digit pairing code shown in the parent dashboard under Add Device." default answer "" with title "Oversight \xe2\x80\x94 Step 1 of 2" buttons {"Cancel", "Install"} default button "Install")')
[ $? -ne 0 ] && exit 0

# Validate
if ! echo "$PAIRING_CODE" | grep -qE '^[0-9]{6}$'; then
  osascript -e 'display alert "Invalid Code" message "Please enter exactly 6 digits." as critical buttons {"OK"} default button "OK"'
  exit 1
fi

notify() { osascript -e "display notification \"$1\" with title \"Oversight\"" 2>/dev/null; }
alert_error() { osascript -e "display alert \"Installation Failed\" message \"$1\" as critical buttons {\"OK\"} default button \"OK\""; }

notify "Installing Oversight... (this may take a minute)"

INSTALL_DIR="$HOME/.oversight"
mkdir -p "$INSTALL_DIR"

# Python check + deps (silent)
if ! command -v python3 &>/dev/null; then
  alert_error "Python 3 is required but not installed. Please install it from python.org and try again."
  exit 1
fi

pip3 install requests --quiet --break-system-packages 2>/dev/null || pip3 install requests --quiet 2>/dev/null

# Download agent
if ! curl -fsSL "$SERVER_URL/api/install/agent.py" -o "$INSTALL_DIR/agent.py" 2>/dev/null; then
  alert_error "Could not reach the Oversight server. Check your internet connection and try again."
  exit 1
fi

# Write config
cat > "$INSTALL_DIR/config.json" <<JSON
{"server_url": "$SERVER_URL", "device_token": ""}
JSON

notify "Pairing with parent account..."

# Pair
cd "$INSTALL_DIR"
PAIR_OUTPUT=$(python3 agent.py --pair-code "$PAIRING_CODE" 2>&1)
if [ $? -ne 0 ]; then
  alert_error "Pairing failed. The code may have expired. Generate a new code in the parent dashboard and try again."
  exit 1
fi

notify "Installing background service..."

# Install LaunchDaemon (needs sudo — osascript handles the password prompt natively)
osascript -e "do shell script \"python3 '$INSTALL_DIR/agent.py' --install\" with administrator privileges"
if [ $? -ne 0 ]; then
  alert_error "Could not install the background service. Please try again."
  exit 1
fi

notify "Installing web filter profile..."

# Download + open MDM profile
DEVICE_TOKEN=$(python3 -c "import json; d=json.load(open('$INSTALL_DIR/config.json')); print(d.get('device_token',''))" 2>/dev/null || echo "")
PROFILE_URL="$SERVER_URL/api/install/mac-profile"
[ -n "$DEVICE_TOKEN" ] && PROFILE_URL="${PROFILE_URL}?token=${DEVICE_TOKEN}"
PROFILE_PATH="/tmp/oversight.mobileconfig"

if curl -fsSL "$PROFILE_URL" -o "$PROFILE_PATH" 2>/dev/null; then
  open "$PROFILE_PATH"
  osascript -e 'display dialog "Almost done!\n\nmacOS has opened System Settings. Click \"Install\" and enter your admin password to activate the web filter.\n\nThis profile prevents the filter from being removed without a passcode." with title "Oversight \xe2\x80\x94 Step 2 of 2" buttons {"Done"} default button "Done" with icon note'
else
  # Profile download failed but agent is installed — not fatal
  osascript -e 'display dialog "Oversight is installed!\n\nNote: The web filter profile could not be downloaded. You can install it later from the parent dashboard." with title "Oversight" buttons {"OK"} default button "OK" with icon note'
fi

osascript -e 'display notification "Oversight is active and protecting this Mac." with title "Oversight" subtitle "Installation complete"'
