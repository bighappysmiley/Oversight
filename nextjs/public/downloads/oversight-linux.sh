#!/bin/bash
# Oversight Linux Installer — by BigHappySmiley
# Run with: bash oversight-linux.sh

set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

clear
echo ""
echo -e "${BOLD}  ████████████████████████████████████████████${NC}"
echo -e "${BOLD}  █                                          █${NC}"
echo -e "${BOLD}  █   O V E R S I G H T                     █${NC}"
echo -e "${BOLD}  █   by BigHappySmiley                     █${NC}"
echo -e "${BOLD}  █                                          █${NC}"
echo -e "${BOLD}  ████████████████████████████████████████████${NC}"
echo ""
echo "  Parental controls installer for Linux"
echo ""

# ── Collect info ─────────────────────────────────────────────────────────────
SERVER_URL=""
while [ -z "$SERVER_URL" ]; do
  echo -ne "${BLUE}  Step 1/3 — Enter your Oversight server URL${NC}\n"
  echo -ne "  (e.g. https://oversight.yourdomain.com): "
  read SERVER_URL
  SERVER_URL="${SERVER_URL%/}"
  if [[ ! "$SERVER_URL" =~ ^https?:// ]]; then
    echo -e "  ${RED}Must start with http:// or https://${NC}"
    SERVER_URL=""
  fi
done

echo ""
PAIRING_CODE=""
while [ -z "$PAIRING_CODE" ]; do
  echo -ne "${BLUE}  Step 2/3 — Enter the 6-digit pairing code${NC}\n"
  echo -ne "  (shown in the parent dashboard under Add Device): "
  read PAIRING_CODE
  if [[ ! "$PAIRING_CODE" =~ ^[0-9]{6}$ ]]; then
    echo -e "  ${RED}Must be exactly 6 digits${NC}"
    PAIRING_CODE=""
  fi
done

echo ""
echo -e "${YELLOW}  Step 3/3 — Installing Oversight...${NC}"
echo ""

INSTALL_DIR="$HOME/.oversight"
mkdir -p "$INSTALL_DIR"

# ── Python check ─────────────────────────────────────────────────────────────
echo -n "  Checking Python 3... "
if ! command -v python3 &>/dev/null; then
  echo ""
  echo -e "  ${RED}Python 3 not found. Installing...${NC}"
  if command -v apt-get &>/dev/null; then
    sudo apt-get update -qq && sudo apt-get install -y python3 python3-pip
  elif command -v dnf &>/dev/null; then
    sudo dnf install -y python3 python3-pip
  elif command -v pacman &>/dev/null; then
    sudo pacman -Sy --noconfirm python python-pip
  else
    echo -e "  ${RED}Could not install Python 3 automatically. Please install it manually.${NC}"
    exit 1
  fi
fi
echo -e "${GREEN}ok${NC}"

# ── Install Python deps ───────────────────────────────────────────────────────
echo -n "  Installing dependencies... "
pip3 install requests --quiet --break-system-packages 2>/dev/null || pip3 install requests --quiet
echo -e "${GREEN}ok${NC}"

# ── Download agent ────────────────────────────────────────────────────────────
echo -n "  Downloading Oversight agent... "
if curl -fsSL "$SERVER_URL/api/install/agent_linux.py" -o "$INSTALL_DIR/agent.py" 2>/dev/null; then
  echo -e "${GREEN}ok${NC}"
else
  echo -e "${RED}failed${NC}"
  echo "  Could not reach the server. Check the URL and try again."
  exit 1
fi

# ── Write initial config ──────────────────────────────────────────────────────
echo -n "  Saving configuration... "
cat > "$INSTALL_DIR/config.json" <<JSON
{
  "server_url": "$SERVER_URL",
  "device_token": ""
}
JSON
echo -e "${GREEN}ok${NC}"

# ── Pair device ───────────────────────────────────────────────────────────────
echo -n "  Pairing with parent account... "
cd "$INSTALL_DIR"
if python3 agent.py --pair-code "$PAIRING_CODE" 2>/dev/null; then
  echo -e "${GREEN}paired${NC}"
else
  echo -e "${RED}failed${NC}"
  echo ""
  echo "  The pairing code may have expired. Generate a new one in the"
  echo "  parent dashboard and run this installer again."
  exit 1
fi

# ── Install systemd service ───────────────────────────────────────────────────
echo ""
echo "  Installing as a background service (requires sudo)..."
sudo python3 "$INSTALL_DIR/agent.py" --install

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}  ✓ Oversight installed successfully!${NC}"
echo ""
echo "  The monitoring agent will start automatically on every boot."
echo "  Your parent can manage settings from the dashboard."
echo ""
echo "  To uninstall:"
echo "    sudo python3 ~/.oversight/agent.py --uninstall"
echo ""
