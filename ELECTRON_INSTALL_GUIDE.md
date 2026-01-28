# Electron Installation Guide

## Issue: npm install Timeout

If `npm install` is timing out, follow these steps:

### Option 1: Install Dependencies Separately (Recommended)

```bash
# Install backend dependencies
npm install --legacy-peer-deps

# Install frontend dependencies
cd client && npm install --legacy-peer-deps && cd ..

# Install Electron dependencies
npm install electron electron-builder electron-is-dev wait-on --save-dev --legacy-peer-deps
```

### Option 2: Increase npm Timeout

```bash
npm config set fetch-timeout 120000
npm config set fetch-retry-mintimeout 20000
npm config set fetch-retry-maxtimeout 120000
npm install
```

### Option 3: Use npm Cache Clean

```bash
npm cache clean --force
npm install --legacy-peer-deps
```

### Option 4: Install with Different Registry

```bash
npm install --registry https://registry.npmjs.org/ --legacy-peer-deps
```

## After Installation

Once dependencies are installed, verify everything is set up:

```bash
# Check Node.js version
node --version

# Check npm version
npm --version

# Verify Electron is installed
npm list electron

# Build the project
npm run build:all

# Run in development
npm run electron:dev
```

## Troubleshooting Installation

### "ERESOLVE unable to resolve dependency tree"

Use the `--legacy-peer-deps` flag:
```bash
npm install --legacy-peer-deps
```

### "npm ERR! code ETIMEDOUT"

Increase timeout and retry:
```bash
npm config set fetch-timeout 120000
npm install --legacy-peer-deps
```

### "npm ERR! code ENOENT"

Clear cache and reinstall:
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### Stuck Installation

Kill the process and try again:
```bash
# macOS/Linux
pkill -f npm

# Windows
taskkill /F /IM npm.exe

# Then retry
npm install --legacy-peer-deps
```

## Quick Install Script

Create a file `install.sh` (macOS/Linux) or `install.bat` (Windows):

### macOS/Linux (install.sh)
```bash
#!/bin/bash
echo "Installing dependencies..."
npm install --legacy-peer-deps
cd client && npm install --legacy-peer-deps && cd ..
npm install electron electron-builder electron-is-dev wait-on --save-dev --legacy-peer-deps
echo "Installation complete!"
```

Run with:
```bash
chmod +x install.sh
./install.sh
```

### Windows (install.bat)
```batch
@echo off
echo Installing dependencies...
call npm install --legacy-peer-deps
cd client && call npm install --legacy-peer-deps && cd ..
call npm install electron electron-builder electron-is-dev wait-on --save-dev --legacy-peer-deps
echo Installation complete!
```

Run with:
```batch
install.bat
```

## Verify Installation

After installation completes, verify:

```bash
# Check all dependencies are installed
npm list --depth=0

# Check Electron specifically
npm list electron

# Check build works
npm run build:all

# Check Electron files compile
npm run build:electron
```

## Next Steps

Once installation is complete:

1. Create app icon: `assets/icon.png` (512x512 PNG)
2. Run development: `npm run electron:dev`
3. Build for distribution: `npm run electron:build:all`

## Still Having Issues?

1. Check Node.js version: `node --version` (should be 18+)
2. Check npm version: `npm --version` (should be 8+)
3. Try a different network connection
4. Check available disk space (need ~2GB)
5. Try on a different machine if possible

## System Requirements

- Node.js 18+
- npm 8+
- 2GB RAM
- 2GB disk space
- Stable internet connection

---

**Need help?** See `ELECTRON_GETTING_STARTED.md` after installation completes.
