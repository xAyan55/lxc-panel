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

# 3. Install Core Dependencies (Panel only)
echo -e "${COLOR_CYAN}[1/5] Installing system dependencies (Node.js & Tools)...${COLOR_RESET}"
apt update -qq
apt install -y -qq curl build-essential git sqlite3 bridge-utils uidmap

# 4. Handle LXC/LXD (Prerequisite Check)
echo -e "${COLOR_CYAN}[2/5] Checking for LXC/LXD Prerequisite...${COLOR_RESET}"

if ! command -v lxc &> /dev/null; then
    echo -e "${COLOR_RED}Err: LXD is not installed on this system.${COLOR_RESET}"
    echo -e "${COLOR_YELLOW}Please install LXD manually using these steps before running this script:${COLOR_RESET}"
    echo -e "${COLOR_PURPLE}"
    echo "1. sudo apt update && sudo apt upgrade -y"
    echo "2. sudo apt install lxc lxc-utils -y"
    echo "3. sudo apt install snapd -y"
    echo "4. sudo systemctl enable --now snapd.socket"
    echo "5. sudo snap install lxd"
    echo "6. sudo usermod -aG lxd \$USER"
    echo "7. newgrp lxd"
    echo "8. sudo lxd init"
    echo "9. sudo apt install bridge-utils uidmap -y"
    echo -e "${COLOR_RESET}"
    echo -e "Refer to documentation for detailed setup. Exiting..."
    exit 1
fi

# Ensure /snap/bin is in PATH for this session (just in case)
export PATH=\$PATH:/snap/bin

# Check if LXD is initialized
if ! lxc profile show default &> /dev/null; then
    echo -e "${COLOR_YELLOW}Warning: LXD 'default' profile not found. Make sure you ran 'lxd init'.${COLOR_RESET}"
    echo -e "You can continue, but the panel might fail to create containers."
    read -p "Continue anyway? (y/n): " confirm
    if [[ \$confirm != [yY] ]]; then exit 1; fi
fi

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
