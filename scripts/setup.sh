#!/bin/bash

# VPS Management Panel - Production Installer
# Designed for Ubuntu 22.04+ (with LXD)

COLOR_PURPLE="\033[0;35m"
COLOR_CYAN="\033[0;36m"
COLOR_GREEN="\033[0;32m"
COLOR_RED="\033[0;31m"
COLOR_RESET="\033[0m"

echo -e "${COLOR_PURPLE}"
echo "--------------------------------------------------"
echo "   🚀 VM PANEL - INSTALLATION SYSTEM             "
echo "--------------------------------------------------"
echo -e "${COLOR_RESET}"

# 1. Check Root
if [[ $EUID -ne 0 ]]; then
   echo -e "${COLOR_RED}Err: This script must be run as root.${COLOR_RESET}"
   exit 1
fi

# 2. Check Package Manager
if ! command -v apt &> /dev/null; then
    echo -e "${COLOR_RED}Err: This installer is designed for Ubuntu/Debian (apt).${COLOR_RESET}"
    exit 1
fi

# 3. Install Core Dependencies
echo -e "${COLOR_CYAN}[1/6] Installing system dependencies...${COLOR_RESET}"
apt update -qq
apt install -y -qq snapd curl build-essential git sqlite3 bridge-utils uidmap

# Try to start snapd if available, but don't fail if systemctl is missing
if command -v systemctl &> /dev/null; then
    systemctl enable snapd 2>/dev/null || true
    systemctl start snapd 2>/dev/null || true
elif command -v service &> /dev/null; then
    service snapd start 2>/dev/null || true
fi

# 4. Handle LXC/LXD
echo -e "${COLOR_CYAN}[2/6] Setting up LXC/LXD...${COLOR_RESET}"

# Attempt to install LXD via Snap
if ! command -v lxc &> /dev/null; then
    echo -e "${COLOR_YELLOW}LXD not found. Attempting installation via Snap...${COLOR_RESET}"
    
    # Aggressively try to start snapd
    if command -v service &> /dev/null; then
        service snapd start || true
        sleep 2
    fi

    if ! snap install lxd --channel=latest/stable; then
        echo -e "${COLOR_RED}ERROR: Snap installation failed.${COLOR_RESET}"
        echo -e "${COLOR_YELLOW}Common causes: Non-systemd environment or Snap not supported.${COLOR_RESET}"
        echo -e "${COLOR_PURPLE}ACTION REQUIRED: Please install LXD manually (e.g., 'apt install lxd-client lxd' if on older Ubuntu, or fix Snap).${COLOR_RESET}"
        echo -e "Once installed, run this script again."
        exit 1
    fi
fi

# Ensure /snap/bin is in PATH for this session
export PATH=$PATH:/snap/bin

echo -e "${COLOR_PURPLE}Initializing LXD...${COLOR_RESET}"
if command -v lxd &> /dev/null; then
    # Try automatic initialization
    lxd init --auto || echo -e "${COLOR_YELLOW}Warning: Auto-init failed. You may need to run 'sudo lxd init' manually later.${COLOR_RESET}"
else
    echo -e "${COLOR_RED}LXD binary not found in PATH. Skipping auto-init.${COLOR_RESET}"
fi

# Add user to lxd group if it exists
if getent group lxd >/dev/null; then
    usermod -aG lxd $USER || true
else
    echo -e "${COLOR_YELLOW}Warning: 'lxd' group not found. You might need to run as root.${COLOR_RESET}"
fi
newgrp lxd 2>/dev/null

# 5. Node.js Environment
echo -e "${COLOR_CYAN}[3/6] Setting up Node.js environment...${COLOR_RESET}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y -qq nodejs
fi

# 6. Build Panel
echo -e "${COLOR_CYAN}[4/6] Building application components...${COLOR_RESET}"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BASE_DIR="$( dirname "$SCRIPT_DIR" )"

cd "$BASE_DIR/backend"
npm install --silent

cd "$BASE_DIR/frontend"
npm install --silent
npm run build --silent

# 7. Configure Environment
echo -e "${COLOR_CYAN}[5/6] Finalizing configuration...${COLOR_RESET}"
cd "$BASE_DIR/backend"
if [ ! -f .env ]; then
    cp .env.example .env
    # Generate random secret
    SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    sed -i "s/change-this-to-a-random-secret-key/$SECRET/" .env
fi

# 8. Create Admin User
echo -e "${COLOR_PURPLE}--------------------------------------------------${COLOR_RESET}"
echo -e "${COLOR_GREEN}       ADMIN ACCOUNT SETUP                        ${COLOR_RESET}"
echo -e "${COLOR_PURPLE}--------------------------------------------------${COLOR_RESET}"
read -p "Enter Admin Email: " ADMIN_EMAIL
read -s -p "Enter Admin Password (min 8 chars): " ADMIN_PASS
echo ""

# Validate password length
if [ ${#ADMIN_PASS} -lt 8 ]; then
    echo -e "${COLOR_RED}Err: Password must be at least 8 characters! Re-run setup.${COLOR_RESET}"
    exit 1
fi

node src/utils/setup.js "$ADMIN_EMAIL" "$ADMIN_PASS"

# 9. Completion
echo -e "${COLOR_CYAN}[6/6] Installation Complete!${COLOR_RESET}"
echo -e "${COLOR_GREEN}"
echo "--------------------------------------------------"
echo "   ✅ VM PANEL INSTALLED SUCCESSFULLY            "
echo "--------------------------------------------------"
echo -e "${COLOR_RESET}"
echo "To start the panel in production mode:"
echo "1. Run backend (Port 3001): cd backend && npm start"
echo "2. Serve frontend (Build folder): Built in frontend/dist"
echo ""
echo "Recommended: Use PM2 to manage processes."
echo "npm install -g pm2"
echo "pm2 start backend/src/server.js --name vmpanel-api"
echo ""
echo -e "${COLOR_CYAN}Default Admin Login: ${COLOR_WHITE}$ADMIN_EMAIL${COLOR_RESET}"
