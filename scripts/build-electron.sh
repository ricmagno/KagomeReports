#!/bin/bash

# Electron Build Script
# Builds the application for desktop distribution

set -e

echo "🔨 Building Historian Reports Desktop App..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo -e "${RED}❌ Node.js 18+ is required. Current version: $(node -v)${NC}"
  exit 1
fi

echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install

echo -e "${YELLOW}🎨 Building backend...${NC}"
npm run build

echo -e "${YELLOW}⚛️  Building frontend...${NC}"
npm run build:client

# Determine platform
PLATFORM=$(uname -s)

if [ "$PLATFORM" = "Darwin" ]; then
  echo -e "${YELLOW}🍎 Building for macOS...${NC}"
  npm run electron:build:mac
  echo -e "${GREEN}✅ macOS build complete!${NC}"
  echo -e "${GREEN}📁 Output: dist/electron/Historian Reports-*.dmg${NC}"
elif [ "$PLATFORM" = "MINGW64_NT" ] || [ "$PLATFORM" = "MSYS_NT" ]; then
  echo -e "${YELLOW}🪟 Building for Windows...${NC}"
  npm run electron:build:win
  echo -e "${GREEN}✅ Windows build complete!${NC}"
  echo -e "${GREEN}📁 Output: dist/electron/Historian Reports Setup *.exe${NC}"
else
  echo -e "${YELLOW}🐧 Building for Linux (not fully supported)...${NC}"
  echo -e "${YELLOW}Please use Windows or macOS for official builds${NC}"
fi

echo -e "${GREEN}✨ Build complete!${NC}"
