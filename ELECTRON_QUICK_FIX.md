# Electron Quick Fix - Build Errors

## Problem

You're getting TypeScript errors when running `npm run build`:

```
error TS2307: Cannot find module 'electron'
error TS2307: Cannot find module 'electron-is-dev'
```

## Solution

### Step 1: Install Electron Dependencies

The Electron packages haven't been installed yet. Install them with:

```bash
npm install electron electron-builder electron-is-dev wait-on --save-dev --legacy-peer-deps
```

If that times out, try:

```bash
npm config set fetch-timeout 120000
npm install --legacy-peer-deps
```

### Step 2: Build Again

Once installation completes:

```bash
npm run build:all
```

This will:
1. Build the backend (excluding Electron files)
2. Build the Electron files separately
3. Build the frontend

### Step 3: Run Development

```bash
npm run electron:dev
```

## If Installation Still Times Out

Use the separate installation approach:

```bash
# Install backend
npm install --legacy-peer-deps

# Install frontend
cd client && npm install --legacy-peer-deps && cd ..

# Install Electron packages
npm install electron@31.0.0 --save-dev --legacy-peer-deps
npm install electron-builder@25.0.0 --save-dev --legacy-peer-deps
npm install electron-is-dev@3.0.1 --save-dev --legacy-peer-deps
npm install wait-on@7.2.0 --save-dev --legacy-peer-deps
```

## What Changed

- `tsconfig.json` - Now excludes `src/electron/**/*`
- `tsconfig.electron.json` - New file for Electron-specific compilation
- `package.json` - Added `build:electron` script

This allows the backend to build without Electron dependencies, and Electron files compile separately.

## Verify It Works

```bash
# Check Electron is installed
npm list electron

# Build everything
npm run build:all

# Run in development
npm run electron:dev
```

## Next Steps

1. Create app icon: `assets/icon.png`
2. Run: `npm run electron:dev`
3. Build: `npm run electron:build:all`

---

**Still stuck?** See `ELECTRON_INSTALL_GUIDE.md` for detailed troubleshooting.
