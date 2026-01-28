#!/bin/bash
# Build script for preparing Historian Reports for Windows packaging

set -e  # Exit immediately if a command exits with a non-zero status

echo "Building Historian Reports for Windows packaging..."

# Check if we're in the correct directory
if [ ! -f "package.json" ]; then
    echo "Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Build the TypeScript code
echo "Building TypeScript code..."
npm run build

# Build the client (if needed)
if [ -d "client" ] && [ -f "client/package.json" ]; then
    echo "Building client application..."
    cd client
    npm install
    npm run build
    cd ..
fi

# Create a dist directory for the packaged application
DIST_DIR="dist-windows"
if [ -d "$DIST_DIR" ]; then
    echo "Cleaning previous build..."
    rm -rf "$DIST_DIR"
fi

mkdir -p "$DIST_DIR"

# Copy necessary files to the distribution directory
echo "Copying application files..."
cp -r dist "$DIST_DIR/"
cp -r client/build "$DIST_DIR/client" 2>/dev/null || echo "Client build not found, skipping..."
cp package.json "$DIST_DIR/"
cp .env.example "$DIST_DIR/"
cp -r reports "$DIST_DIR/" 2>/dev/null || mkdir "$DIST_DIR/reports"
cp -r logs "$DIST_DIR/" 2>/dev/null || mkdir "$DIST_DIR/logs"
cp -r temp "$DIST_DIR/" 2>/dev/null || mkdir "$DIST_DIR/temp"
cp -r data "$DIST_DIR/" 2>/dev/null || mkdir "$DIST_DIR/data"
cp README.md "$DIST_DIR/"
cp LICENSE "$DIST_DIR/"
cp WINDOWS_INSTALLATION_GUIDE.md "$DIST_DIR/"

# Create a Windows-specific startup script
cat > "$DIST_DIR/start-server.bat" << 'EOF'
@echo off
REM Historian Reports Startup Script for Windows

setlocal

REM Check if Node.js is available
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js (v18.0.0 or higher) from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if .env file exists, copy from example if not
if not exist ".env" (
    echo Creating .env file from example...
    copy .env.example .env
    echo Please edit .env file with your database and application settings
    pause
)

REM Start the application
echo Starting Historian Reports...
node dist\server.js

pause
EOF

# Create a Windows service installation script
cat > "$DIST_DIR/install-service.bat" << 'EOF'
@echo off
REM Windows Service Installation Script for Historian Reports
REM This script installs the application as a Windows Service using NSSM

setlocal

REM Check if running as administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo This script must be run as administrator.
    echo Right-click on this script and select "Run as administrator".
    pause
    exit /b 1
)

REM Check if NSSM is available
if not exist "nssm.exe" (
    echo NSSM (Non-Sucking Service Manager) not found.
    echo Downloading NSSM...
    
    REM Create temporary directory for download
    set TEMP_DIR=temp
    if not exist "%TEMP_DIR%" mkdir "%TEMP_DIR%"
    
    REM Download NSSM (would typically use PowerShell or curl here)
    echo Please download NSSM from https://nssm.cc/download
    echo Extract the archive and place nssm.exe in this directory.
    pause
    exit /b 1
)

REM Install the service
echo Installing Historian Reports as Windows Service...
nssm install "HistorianReports" "node.exe" "dist\server.js"

if %errorlevel% neq 0 (
    echo Failed to install the service.
    pause
    exit /b 1
)

REM Configure the service
echo Configuring the service...
nssm set "HistorianReports" Description "Historian Reports Application Service"
nssm set "HistorianReports" Start SERVICE_AUTO_START
nssm set "HistorianReports" AppDirectory "%CD%"
nssm set "HistorianReports" AppParameters "--env-file=%CD%\.env"

REM Start the service
echo Starting the service...
nssm start "HistorianReports"

if %errorlevel% neq 0 (
    echo Failed to start the service.
    echo The installation completed but the service failed to start.
    echo Please check the application logs in the logs directory.
    pause
    exit /b 1
)

echo.
echo Historian Reports has been successfully installed as a Windows Service.
echo Service name: HistorianReports
echo Service will start automatically on system boot.
echo.
echo To manage the service, use Windows Services (services.msc) or NSSM commands:
echo   - Start: nssm start HistorianReports
echo   - Stop: nssm stop HistorianReports
echo   - Restart: nssm restart HistorianReports
echo   - Remove: nssm remove HistorianReports confirm
echo.
pause
EOF

# Create a Windows service removal script
cat > "$DIST_DIR/remove-service.bat" << 'EOF'
@echo off
REM Windows Service Removal Script for Historian Reports

setlocal

REM Check if running as administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo This script must be run as administrator.
    echo Right-click on this script and select "Run as administrator".
    pause
    exit /b 1
)

REM Check if NSSM is available
if not exist "nssm.exe" (
    echo NSSM (Non-Sucking Service Manager) not found.
    echo Please ensure NSSM is available in this directory.
    pause
    exit /b 1
)

REM Check if the service exists
sc query "HistorianReports" >nul
if %errorlevel% neq 0 (
    echo Service "HistorianReports" not found.
    echo Nothing to remove.
    pause
    exit /b 0
)

REM Stop the service
echo Stopping the Historian Reports service...
nssm stop "HistorianReports"

if %errorlevel% neq 0 (
    echo Warning: Failed to stop the service. It may already be stopped.
)

REM Remove the service
echo Removing the Historian Reports service...
nssm remove "HistorianReports" confirm

if %errorlevel% neq 0 (
    echo Failed to remove the service.
    pause
    exit /b 1
)

echo.
echo Historian Reports service has been successfully removed.
echo.
pause
EOF

# Create a configuration validation script
cat > "$DIST_DIR/validate-config.bat" << 'EOF'
@echo off
REM Configuration Validation Script for Historian Reports

setlocal

REM Check if Node.js is available
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js (v18.0.0 or higher) from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if required files exist
if not exist "package.json" (
    echo ERROR: package.json not found
    pause
    exit /b 1
)

if not exist "dist\server.js" (
    echo ERROR: dist\server.js not found
    echo Please build the application first
    pause
    exit /b 1
)

REM Check if .env file exists
if not exist ".env" (
    if exist ".env.example" (
        echo WARNING: .env file not found, copying from .env.example
        copy .env.example .env
        echo Please edit .env file with your database and application settings
    ) else (
        echo ERROR: Neither .env nor .env.example found
        pause
        exit /b 1
    )
)

REM Validate environment configuration
echo Validating environment configuration...
node -e "
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(process.cwd(), '.env') });

// Required environment variables
const requiredEnvVars = [
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
    'NODE_ENV',
    'PORT',
    'JWT_SECRET'
];

let missingEnvVars = [];
requiredEnvVars.forEach(envVar => {
    if (!process.env[envVar]) {
        missingEnvVars.push(envVar);
    }
});

if (missingEnvVars.length > 0) {
    console.log('ERROR: Missing required environment variables:');
    missingEnvVars.forEach(envVar => {
        console.log('  - ' + envVar);
    });
    process.exit(1);
}

// Validate JWT secret length
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.log('WARNING: JWT_SECRET should be at least 32 characters long for security');
}

console.log('Environment configuration validation passed');
"

if %errorlevel% neq 0 (
    echo Configuration validation failed.
    pause
    exit /b 1
)

echo.
echo Configuration validation completed successfully.
echo.
pause
EOF

echo "Windows packaging build completed!"
echo "Distribution files are in: $DIST_DIR"
echo ""
echo "To create an NSIS installer:"
echo "  1. Install NSIS (https://nsis.sourceforge.io/Download)"
echo "  2. Modify the installer.nsi file with your settings"
echo "  3. Run: makensis installer.nsi"
echo ""
echo "To create a portable ZIP package:"
echo "  1. Zip the contents of $DIST_DIR"
echo "  2. Distribute the ZIP file to users"