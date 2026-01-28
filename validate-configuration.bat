@echo off
REM Configuration Validation Script for Historian Reports
REM This script validates the installation and configuration of Historian Reports

setlocal

REM Define application directory
set APP_DIR=%~dp0
set APP_DIR=%APP_DIR:~0,-1%

echo =========================================
echo Historian Reports Configuration Validator
echo =========================================
echo.

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

if not exist "%APP_DIR%\.env" (
    if exist "%APP_DIR%\.env.example" (
        echo WARNING: .env file not found, copying from .env.example
        copy "%APP_DIR%\.env.example" "%APP_DIR%\.env"
    ) else (
        echo ERROR: Neither .env nor .env.example found in %APP_DIR%
        pause
        exit /b 1
    )
)

REM Check if required directories exist
echo Checking required directories...
if not exist "%APP_DIR%\reports" (
    echo Creating reports directory...
    mkdir "%APP_DIR%\reports"
)

if not exist "%APP_DIR%\logs" (
    echo Creating logs directory...
    mkdir "%APP_DIR%\logs"
)

if not exist "%APP_DIR%\temp" (
    echo Creating temp directory...
    mkdir "%APP_DIR%\temp"
)

if not exist "%APP_DIR%\data" (
    echo Creating data directory...
    mkdir "%APP_DIR%\data"
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
if (process.env.JWT_SECRET.length < 32) {
    console.log('WARNING: JWT_SECRET should be at least 32 characters long for security');
}

console.log('Environment configuration validation passed');
"

if %errorlevel% neq 0 (
    echo Configuration validation failed.
    pause
    exit /b 1
)

REM Check database connectivity if possible
echo Checking database connectivity...
node -e "
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env') });

const config = {
    server: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 1433,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
        encrypt: process.env.DB_ENCRYPT !== 'false',
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true'
    }
};

const sql = require('mssql');

(async () => {
    try {
        console.log('Attempting to connect to the database...');
        await sql.connect(config);
        console.log('Database connection successful');
        process.exit(0);
    } catch (err) {
        console.error('Database connection failed:', err.message);
        process.exit(1);
    }
})();
" >nul 2>&1

if %errorlevel% neq 0 (
    echo WARNING: Could not establish database connection.
    echo Please verify your database configuration in .env file.
) else (
    echo Database connection successful.
)

echo.
echo =========================================
echo Configuration validation completed
echo =========================================
echo.
echo The application appears to be properly configured.
echo You can now start the application with: node dist\server.js
echo.
pause