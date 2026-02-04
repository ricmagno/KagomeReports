#!/bin/bash

# ==============================================================================
# Historian Reports - Ubuntu Installation Script
# Target: Ubuntu 24.04.3 LTS (Noble)
# ==============================================================================

# Exit on error
set -e

# Default variables
INSTALL_DIR="/opt/historian-reports"
DATA_BASE_DIR="/mnt/historian"
USER_NAME="historian"
GROUP_NAME="historian"

echo "===================================================="
echo "Installing Historian Reports on Ubuntu"
echo "===================================================="

# Check for root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo)"
  exit 1
fi

# 1. Install System Dependencies
echo "[1/6] Installing system dependencies..."
apt-get update
apt-get install -y \
    curl \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    pkg-config

# 2. Check/Install Node.js 20
if ! command -v node &> /dev/null || [[ $(node -v) != v20* ]]; then
    echo "Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# 3. Create User and Groups
echo "[2/6] Setting up system user..."
if ! getent group "$GROUP_NAME" > /dev/null; then
    groupadd "$GROUP_NAME"
fi
if ! getent passwd "$USER_NAME" > /dev/null; then
    useradd -r -g "$GROUP_NAME" -d "$INSTALL_DIR" -s /sbin/nologin "$USER_NAME"
fi

# 4. Setup Directories
echo "[3/6] Setting up directories..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$DATA_BASE_DIR/data"
mkdir -p "$DATA_BASE_DIR/reports"
mkdir -p "$DATA_BASE_DIR/logs"
mkdir -p "$DATA_BASE_DIR/temp"

# 5. Extract Application (assuming the tarball is in current directory)
echo "[4/6] Deploying application files..."
TARBALL=$(ls historian-reports-v*.tar.gz | head -n 1)
if [ -f "$TARBALL" ]; then
    tar -xzf "$TARBALL" -C "$INSTALL_DIR"
else
    echo "Warning: No tarball found in current directory. Copying from current location..."
    # If running from source/build directory
    cp -r dist "$INSTALL_DIR/"
    cp -r client/build "$INSTALL_DIR/client/" || mkdir -p "$INSTALL_DIR/client/build"
    cp -r templates "$INSTALL_DIR/"
    cp package.json "$INSTALL_DIR/"
    cp package-lock.json "$INSTALL_DIR/"
fi

# Install production dependencies
cd "$INSTALL_DIR"
npm install --production

# Create .env from example or preserve existing
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cat > .env <<EOF
NODE_ENV=production
PORT=3001
DATA_DIR=$DATA_BASE_DIR/data
REPORTS_DIR=$DATA_BASE_DIR/reports
LOG_FILE=$DATA_BASE_DIR/logs/app.log
TEMP_DIR=$DATA_BASE_DIR/temp
EOF
fi

# 6. Set Permissions
echo "[5/6] Setting permissions..."
chown -R "$USER_NAME":"$GROUP_NAME" "$INSTALL_DIR"
chown -R "$USER_NAME":"$GROUP_NAME" "$DATA_BASE_DIR"
chmod -R 755 "$DATA_BASE_DIR"

# 7. Install Systemd Service
echo "[6/6] Installing systemd service..."
cat > /etc/systemd/system/historian-reports.service <<EOF
[Unit]
Description=Historian Reports Service
After=network.target mssql-server.service

[Service]
Type=simple
User=$USER_NAME
Group=$GROUP_NAME
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/node dist/server.js
Restart=always
Environment=NODE_ENV=production
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable historian-reports

echo "===================================================="
echo "Installation Complete!"
echo "===================================================="
echo "Service is configured to use: $DATA_BASE_DIR"
echo "To start the service: sudo systemctl start historian-reports"
echo "To check status: sudo systemctl status historian-reports"
echo "To view logs: sudo journalctl -u historian-reports -f"
echo "===================================================="
