# Electron Desktop App Setup Guide

This guide explains how to package the Historian Reports application as a desktop app for Windows and macOS using Electron.

## Project Structure

```
historian-reports/
├── src/
│   ├── electron/
│   │   ├── main.ts          # Electron main process
│   │   └── preload.ts       # Preload script for IPC
│   ├── server.ts            # Express backend
│   └── ...
├── client/                  # React frontend
├── assets/
│   ├── entitlements.mac.plist  # macOS signing entitlements
│   └── icon.png             # App icon (required)
├── electron.js              # Entry point for Electron
├── package.json             # Updated with Electron config
└── tsconfig.json
```

## Prerequisites

### System Requirements

**Windows:**
- Windows 7 or later
- Node.js 18+
- npm or yarn

**macOS:**
- macOS 10.13 or later
- Node.js 18+
- npm or yarn
- Xcode Command Line Tools (for code signing)

### Install Xcode Command Line Tools (macOS only)

```bash
xcode-select --install
```

## Installation

### 1. Install Dependencies

```bash
npm install
cd client && npm install && cd ..
```

### 2. Create App Icon

Create a 512x512 PNG icon and save it as `assets/icon.png`. This will be used for both Windows and macOS.

For production, you may want to create platform-specific icons:
- Windows: `assets/icon.ico` (256x256 or larger)
- macOS: `assets/icon.icns` (1024x1024)

## Development

### Run in Development Mode

```bash
npm run electron:dev
```

This will:
1. Start the Express backend server
2. Start the React development server
3. Launch Electron with DevTools open

The app will automatically reload when you make changes to the backend or frontend code.

## Building

### Build for Windows

```bash
npm run electron:build:win
```

This creates:
- `dist/electron/Historian Reports Setup 0.65.0.exe` - NSIS installer
- `dist/electron/Historian Reports 0.65.0.exe` - Portable executable

### Build for macOS

```bash
npm run electron:build:mac
```

This creates:
- `dist/electron/Historian Reports-0.65.0.dmg` - DMG installer
- `dist/electron/Historian Reports-0.65.0.zip` - ZIP archive

### Build for Both Platforms

```bash
npm run electron:build:all
```

## Configuration

### Electron Builder Configuration

The `package.json` includes electron-builder configuration:

```json
{
  "build": {
    "appId": "com.historianreports.app",
    "productName": "Historian Reports",
    "directories": {
      "buildResources": "assets",
      "output": "dist/electron"
    },
    "files": [
      "dist/**/*",
      "client/build/**/*",
      "data/**/*",
      "templates/**/*",
      "node_modules/**/*",
      "package.json"
    ],
    "win": { ... },
    "mac": { ... }
  }
}
```

### Windows Configuration

- **NSIS Installer**: One-click installation with custom directory selection
- **Portable Executable**: Standalone executable, no installation required
- **Architectures**: x64 and ia32 (32-bit)

### macOS Configuration

- **DMG Installer**: Drag-and-drop installation
- **ZIP Archive**: For distribution
- **Code Signing**: Requires Apple Developer Certificate (optional for development)
- **Notarization**: Required for distribution on macOS 10.15+

## Code Signing (Production)

### Windows Code Signing

To sign the Windows installer:

1. Obtain a code signing certificate
2. Set environment variables:
   ```bash
   set WIN_CSC_LINK=path/to/certificate.pfx
   set WIN_CSC_KEY_PASSWORD=your_password
   ```
3. Build: `npm run electron:build:win`

### macOS Code Signing

To sign the macOS app:

1. Obtain an Apple Developer Certificate
2. Set environment variables:
   ```bash
   export CSC_LINK=path/to/certificate.p12
   export CSC_KEY_PASSWORD=your_password
   export APPLE_ID=your_apple_id
   export APPLE_ID_PASSWORD=your_app_specific_password
   ```
3. Build: `npm run electron:build:mac`

For notarization (required for distribution):

1. Create an app-specific password in Apple ID settings
2. Set the environment variables above
3. The build process will automatically notarize the app

## Application Data

The application stores data in platform-specific directories:

**Windows:**
```
C:\Users\[username]\AppData\Roaming\Historian Reports\
```

**macOS:**
```
~/Library/Application Support/Historian Reports/
```

Data includes:
- SQLite databases (`data/`)
- Configuration files
- Generated reports (`reports/`)
- Logs

## Troubleshooting

### App Won't Start

1. Check the logs in the application data directory
2. Ensure the backend server is running: `npm run dev`
3. Verify port 3000 is available for the React dev server
4. Check that all dependencies are installed: `npm install`

### Build Fails

1. Clear the build cache: `rm -rf dist/electron`
2. Rebuild: `npm run electron:build:all`
3. Check Node.js version: `node --version` (should be 18+)

### Windows Installer Issues

1. Ensure you have admin privileges
2. Disable antivirus temporarily during installation
3. Try the portable executable instead

### macOS Code Signing Issues

1. Verify certificate is in Keychain: `security find-identity -v -p codesigning`
2. Check certificate expiration
3. For development, code signing can be skipped by removing `certificateFile` from config

## Distribution

### Windows

1. Build the installer: `npm run electron:build:win`
2. Test on a clean Windows machine
3. Distribute the `.exe` file or create a GitHub release

### macOS

1. Build the DMG: `npm run electron:build:mac`
2. Test on a clean macOS machine
3. For distribution, ensure the app is notarized
4. Create a GitHub release with the `.dmg` file

## Auto-Updates

The application includes auto-update functionality. To enable:

1. Set up a GitHub release with the built artifacts
2. Configure the update checker in the app settings
3. Users will be notified of new versions automatically

See `src/services/autoUpdateService.ts` for implementation details.

## Performance Optimization

### Bundle Size

The Electron app includes:
- Node.js runtime (~150MB)
- Chromium (~200MB)
- Application code (~50MB)

Total size: ~400MB (varies by platform)

### Memory Usage

- Typical memory usage: 200-300MB
- Can be optimized by:
  - Lazy loading modules
  - Reducing bundle size
  - Implementing memory profiling

## Security Considerations

1. **Context Isolation**: Enabled by default in preload.ts
2. **Sandbox**: Enabled for renderer process
3. **Node Integration**: Disabled for security
4. **IPC Communication**: Use secure message passing
5. **Code Signing**: Recommended for production

## Next Steps

1. Create app icons in `assets/`
2. Test the development build: `npm run electron:dev`
3. Build for your target platform
4. Test on a clean machine
5. Set up code signing for production
6. Configure auto-updates
7. Distribute to users

## Additional Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [Electron Builder Documentation](https://www.electron.build/)
- [Code Signing Guide](https://www.electron.build/code-signing)
- [Auto-Update Guide](https://www.electron.build/auto-update)
