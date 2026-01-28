@echo off
REM Database Setup Script for Historian Reports on Windows
REM This script sets up the required database tables and initial data for Historian Reports

setlocal

REM Define application directory
set APP_DIR=%~dp0
set APP_DIR=%APP_DIR:~0,-1%

echo =========================================
echo Historian Reports Database Setup
echo =========================================
echo.

REM Check if running as administrator (not strictly required for database setup, but good practice)
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo WARNING: This script is not running as administrator.
    echo Some operations might fail if the application is installed in a protected directory.
    echo.
)

REM Check if Node.js is available
echo Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js (v18.0.0 or higher) from https://nodejs.org/
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo Found Node.js version: !NODE_VERSION!
)

REM Check if npm is available
echo Checking npm installation...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: npm is not installed or not in PATH
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
    echo Found npm version: !NPM_VERSION!
)

REM Check if required files exist
echo Checking required files...
if not exist "%APP_DIR%\package.json" (
    echo ERROR: package.json not found in %APP_DIR%
    pause
    exit /b 1
)

if not exist "%APP_DIR%\dist\server.js" (
    echo ERROR: dist\server.js not found in %APP_DIR%
    echo Please build the application first using 'npm run build'
    pause
    exit /b 1
)

REM Check if .env file exists
if not exist "%APP_DIR%\.env" (
    if exist "%APP_DIR%\.env.example" (
        echo .env file not found, copying from .env.example
        copy "%APP_DIR%\.env.example" "%APP_DIR%\.env"
        echo Please edit .env file with your database settings before continuing
        pause
        exit /b 0
    ) else (
        echo ERROR: Neither .env nor .env.example found in %APP_DIR%
        pause
        exit /b 1
    )
)

REM Install dependencies if node_modules doesn't exist
if not exist "%APP_DIR%\node_modules" (
    echo Installing Node.js dependencies...
    cd /d "%APP_DIR%"
    npm install --production
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Run database setup
echo Setting up database tables and initial data...
cd /d "%APP_DIR%"

REM Execute the database setup script
node -e "
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(process.cwd(), '.env') });

// Import database setup functions
const { initializeDatabase } = require('./dist/services/databaseConfigService');
const { initializeUsers } = require('./dist/services/userManagementService');
const { initializeSchedules } = require('./dist/services/schedulerService');

async function setupDatabase() {
    try {
        console.log('Initializing database...');
        await initializeDatabase();
        console.log('Database initialized successfully.');
        
        console.log('Setting up initial users...');
        await initializeUsers();
        console.log('Initial users created successfully.');
        
        console.log('Setting up initial schedules...');
        await initializeSchedules();
        console.log('Initial schedules created successfully.');
        
        console.log('');
        console.log('Database setup completed successfully!');
        console.log('Tables created:');
        console.log('- users');
        console.log('- reports');
        console.log('- schedules');
        console.log('- configurations');
        console.log('');
        console.log('Default admin user:');
        console.log('- Username: admin');
        console.log('- Password: admin123 (please change immediately after first login)');
        console.log('');
    } catch (error) {
        console.error('Database setup failed:', error.message);
        process.exit(1);
    }
}

setupDatabase();
"

if %errorlevel% neq 0 (
    echo Database setup failed.
    echo Please check the error messages above and your database configuration.
    echo Verify that your database server is running and accessible.
    pause
    exit /b 1
)

echo.
echo =========================================
echo Database Setup Completed Successfully
echo =========================================
echo.
echo The database tables have been created and initial data has been populated.
echo.
echo Important:
echo - Change the default admin password immediately after first login
echo - Verify your database connection settings in the .env file
echo - Check the application logs in the logs directory for any issues
echo.
pause