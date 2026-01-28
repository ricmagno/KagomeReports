@echo off
REM Electron Build Script for Windows
REM Builds the application for desktop distribution

setlocal enabledelayedexpansion

echo.
echo 🔨 Building Historian Reports Desktop App...
echo.

REM Check Node.js version
for /f "tokens=1" %%i in ('node -v') do set NODE_VERSION=%%i
echo Node.js version: %NODE_VERSION%

echo.
echo 📦 Installing dependencies...
call npm install
if errorlevel 1 (
  echo ❌ Failed to install dependencies
  exit /b 1
)

echo.
echo 🎨 Building backend...
call npm run build
if errorlevel 1 (
  echo ❌ Failed to build backend
  exit /b 1
)

echo.
echo ⚛️  Building frontend...
call npm run build:client
if errorlevel 1 (
  echo ❌ Failed to build frontend
  exit /b 1
)

echo.
echo 🪟 Building for Windows...
call npm run electron:build:win
if errorlevel 1 (
  echo ❌ Failed to build Windows installer
  exit /b 1
)

echo.
echo ✅ Windows build complete!
echo 📁 Output: dist\electron\Historian Reports Setup *.exe
echo.
echo ✨ Build complete!
echo.
