#!/bin/bash
# Oversight Mac Agent Installer
# Double-click this file to install.

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "  ██████  ██    ██ ███████ ██████  ███████ ██  ██████  ██   ██ ████████"
echo "  ██    ██ ██    ██ ██      ██   ██ ██      ██ ██       ██   ██    ██   "
echo "  ██    ██ ██    ██ █████   ██████  ███████ ██ ██   ███ ███████    ██   "
echo "  ██    ██  ██  ██  ██      ██   ██      ██ ██ ██    ██ ██   ██    ██   "
echo "  ██████    ████   ███████ ██   ██ ███████ ██  ██████  ██   ██    ██   "
echo ""
echo "  by BigHappySmiley"
echo ""

SERVER_URL=""
PAIRING_CODE=""

# Prompt for server URL
while [ -z "$SERVER_URL" ]; do
  read -p "$(echo -e ${BLUE}Enter your Oversight server URL${NC} [e.g. https://oversight.example.com]: )" SERVER_URL
done

# Prompt for pairing code
while [ -z "$PAIRING_CODE" ]; do
  read -p "$(echo -e ${BLUE}Enter the 6-digit pairing code from the parent dashboard${NC}: )" PAIRING_CODE
done

INSTALL_DIR="$HOME/.oversight"
mkdir -p "$INSTALL_DIR"

# Check for Python 3
echo ""
echo -e "${YELLOW}Checking Python 3...${NC}"
if ! command -v python3 &> /dev/null; then
  echo -e "${RED}Python 3 not found. Installing via Homebrew...${NC}"
  if ! command -v brew &> /dev/null; then
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  fi
  brew install python3
fi
echo -e "${GREEN}Python 3 found.${NC}"

# Install requests
echo -e "${YELLOW}Installing Python dependencies...${NC}"
pip3 install requests --quiet --break-system-packages 2>/dev/null || pip3 install requests --quiet
echo -e "${GREEN}Dependencies installed.${NC}"

# Download agent
echo -e "${YELLOW}Downloading Oversight agent...${NC}"
curl -fsSL "$SERVER_URL/download/agent.py" -o "$INSTALL_DIR/agent.py" 2>/dev/null || {
  # Fallback: copy from current directory if available
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  if [ -f "$SCRIPT_DIR/agent.py" ]; then
    cp "$SCRIPT_DIR/agent.py" "$INSTALL_DIR/agent.py"
  else
    echo -e "${RED}Could not download agent. Make sure your server is running.${NC}"
    exit 1
  fi
}

# Write config
cat > "$INSTALL_DIR/config.json" << EOF
{
  "server_url": "$SERVER_URL",
  "device_token": ""
}
EOF

# Pair device
echo -e "${YELLOW}Pairing device with parent account...${NC}"
cd "$INSTALL_DIR"
python3 agent.py --pair-code "$PAIRING_CODE"

echo ""
echo -e "${GREEN}Installing as system service...${NC}"
sudo python3 "$INSTALL_DIR/agent.py" --install

echo ""
echo -e "${GREEN}✓ Oversight installed successfully!${NC}"
echo "  The agent will start automatically when this Mac boots."
echo "  You can manage settings from the parent dashboard."
echo ""
read -p "Press Enter to close..."
