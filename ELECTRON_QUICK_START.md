# Electron Desktop App - Quick Start

Get the Historian Reports application running as a desktop app in minutes.

## 🚀 Quick Start (5 minutes)

### 1. Install Dependencies
```bash
npm install
cd client && npm install && cd ..
```

### 2. Create App Icon
Save a 512x512 PNG image as `assets/icon.png`

### 3. Run in Development
```bash
npm run electron:dev
```

The app will launch with:
- Backend server running on port 3000
- React dev server on port 3000
- Electron window with DevTools

## 📦 Building for Distribution

### Windows
```bash
npm run electron:build:win
```
Creates installers in `dist/electron/`:
- `Historian Reports Setup 0.65.0.exe` - NSIS installer
- `Historian Reports 0.65.0.exe` - Portable executable

### macOS
```bash
npm run electron:build:mac
```
Creates installers in `dist/electron/`:
- `Historian Reports-0.65.0.dmg` - DMG installer
- `Historian Reports-0.65.0.zip` - ZIP archive

### Both Platforms
```bash
npm run electron:build:all
```

## 📁 Project Structure

```
src/electron/
├── main.ts          # Electron main process
│                    # - Creates window
│                    # - Starts backend server
│                    # - Handles IPC
└── preload.ts       # Secure IPC bridge
                     # - Exposes safe APIs to renderer
```

## 🔧 Configuration

### App Settings
Edit `package.json` `build` section:
- `appId`: Unique identifier (e.g., `com.historianreports.app`)
- `productName`: Display name
- `version`: App version

### Windows Options
- NSIS installer with custom directory selection
- Portable executable for USB distribution
- 32-bit and 64-bit support

### macOS Options
- DMG installer with drag-and-drop
- Code signing support (optional)
- Notarization support for distribution

## 🎯 Common Tasks

### Change App Name
Edit `package.json`:
```json
{
  "name": "historian-reports",
  "build": {
    "productName": "Your App Name"
  }
}
```

### Change App Icon
1. Create 512x512 PNG: `assets/icon.png`
2. For Windows: Create `assets/icon.ico`
3. For macOS: Create `assets/icon.icns`

### Update Version
Edit `package.json`:
```json
{
  "version": "1.0.0"
}
```

### Enable Code Signing (Production)

**Windows:**
```bash
set WIN_CSC_LINK=path/to/certificate.pfx
set WIN_CSC_KEY_PASSWORD=password
npm run electron:build:win
```

**macOS:**
```bash
export CSC_LINK=path/to/certificate.p12
export CSC_KEY_PASSWORD=password
export APPLE_ID=your@email.com
export APPLE_ID_PASSWORD=app_password
npm run electron:build:mac
```

## 🐛 Troubleshooting

### App Won't Start
```bash
# Check backend is running
npm run dev

# Check frontend dev server
cd client && npm start
```

### Build Fails
```bash
# Clear cache and rebuild
rm -rf dist/electron
npm run electron:build:all
```

### Port Already in Use
```bash
# Kill process on port 3000
# Windows: netstat -ano | findstr :3000
# macOS/Linux: lsof -i :3000
```

## 📚 Full Documentation

See `ELECTRON_SETUP_GUIDE.md` for:
- Detailed setup instructions
- Code signing guide
- Auto-update configuration
- Performance optimization
- Security best practices

## 🔗 Useful Links

- [Electron Docs](https://www.electronjs.org/docs)
- [Electron Builder](https://www.electron.build/)
- [Code Signing](https://www.electron.build/code-signing)
- [Auto-Update](https://www.electron.build/auto-update)

## ✅ Checklist for Release

- [ ] Update version in `package.json`
- [ ] Create app icon (`assets/icon.png`)
- [ ] Test development build: `npm run electron:dev`
- [ ] Build for target platform
- [ ] Test installer on clean machine
- [ ] Set up code signing (production)
- [ ] Configure auto-updates
- [ ] Create GitHub release
- [ ] Distribute to users

## 💡 Tips

1. **Development**: Use `npm run electron:dev` for hot reload
2. **Testing**: Build locally and test before distribution
3. **Icons**: Use high-quality 512x512 PNG for best results
4. **Signing**: Code signing is optional for development, required for distribution
5. **Updates**: Configure auto-updates for seamless user experience

---

**Need help?** Check `ELECTRON_SETUP_GUIDE.md` for detailed documentation.
