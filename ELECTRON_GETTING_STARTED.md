# Getting Started with Electron Desktop App

Follow this checklist to get the Historian Reports desktop app up and running.

## ✅ Pre-Flight Checklist

- [ ] Node.js 18+ installed (`node --version`)
- [ ] npm installed (`npm --version`)
- [ ] Git installed
- [ ] Code editor (VS Code recommended)
- [ ] 2GB RAM available
- [ ] 1GB disk space available

## 📋 Step-by-Step Setup

### Step 1: Clone/Open Project
```bash
cd historian-reports
```

### Step 2: Install Dependencies
```bash
npm install
cd client && npm install && cd ..
```

**Expected output:**
```
added XXX packages in X.XXs
```

### Step 3: Create App Icon
1. Create a 512x512 PNG image (or use existing logo)
2. Save as `assets/icon.png`

**Quick option:** Use a placeholder
```bash
mkdir -p assets
# Copy your icon here or use a placeholder
```

### Step 4: Configure Environment (Optional)
Copy `.env.electron` to `.env` if needed:
```bash
cp .env.electron .env
```

Edit `.env` with your database settings if different from defaults.

### Step 5: Run Development Build
```bash
npm run electron:dev
```

**Expected behavior:**
1. Backend server starts (port 3000)
2. React dev server starts
3. Electron window opens
4. DevTools panel appears

### Step 6: Test the App
1. Navigate through the application
2. Test report generation
3. Check that data loads correctly
4. Verify no console errors

### Step 7: Build for Distribution
Choose your platform:

**Windows:**
```bash
npm run electron:build:win
```

**macOS:**
```bash
npm run electron:build:mac
```

**Both:**
```bash
npm run electron:build:all
```

**Expected output:**
```
dist/electron/
├── Historian Reports Setup 0.65.0.exe
└── Historian Reports 0.65.0.exe
```

## 🎯 Common Tasks

### Run Development Server
```bash
npm run electron:dev
```

### Build for Windows Only
```bash
npm run electron:build:win
```

### Build for macOS Only
```bash
npm run electron:build:mac
```

### Build for Both Platforms
```bash
npm run electron:build:all
```

### Clean Build
```bash
rm -rf dist/electron
npm run electron:build:all
```

### Run Backend Only
```bash
npm run dev
```

### Run Frontend Only
```bash
cd client && npm start
```

## 🔧 Troubleshooting Quick Fixes

### "Port 3000 already in use"
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :3000
kill -9 <PID>
```

### "Cannot find module 'electron'"
```bash
npm install electron --save-dev
```

### "Icon file not found"
```bash
mkdir -p assets
# Add icon.png to assets folder
npm run electron:build:all
```

### "Build fails"
```bash
rm -rf node_modules dist
npm install
npm run build:all
npm run electron:build:all
```

## 📁 Project Structure

```
historian-reports/
├── src/
│   ├── electron/
│   │   ├── main.ts          ← Electron main process
│   │   └── preload.ts       ← IPC bridge
│   └── server.ts            ← Express backend
├── client/                  ← React frontend
├── assets/
│   └── icon.png            ← App icon (required)
├── dist/
│   └── electron/           ← Build output
├── electron.js             ← Entry point
└── package.json            ← Configuration
```

## 🚀 Development Workflow

### 1. Start Development
```bash
npm run electron:dev
```

### 2. Make Changes
- Edit backend: `src/**/*.ts`
- Edit frontend: `client/src/**/*.tsx`
- Changes auto-reload

### 3. Test Changes
- Backend: Restart Electron (Ctrl+R)
- Frontend: Auto-reloads
- Check DevTools for errors

### 4. Build for Testing
```bash
npm run electron:build:all
```

### 5. Test Installer
- Run the `.exe` (Windows) or `.dmg` (macOS)
- Verify installation
- Test functionality

## 📦 Distribution

### For Windows Users
1. Build: `npm run electron:build:win`
2. Share: `dist/electron/Historian Reports Setup 0.65.0.exe`
3. Users run installer and follow prompts

### For macOS Users
1. Build: `npm run electron:build:mac`
2. Share: `dist/electron/Historian Reports-0.65.0.dmg`
3. Users drag app to Applications folder

### For Both
1. Build: `npm run electron:build:all`
2. Create GitHub release
3. Upload both installers
4. Share download link

## 🔐 Security Notes

✅ **Already Configured:**
- Context isolation enabled
- Sandbox enabled
- Node integration disabled
- Secure IPC communication

⚠️ **For Production:**
- Code sign the app (optional but recommended)
- Enable auto-updates
- Use HTTPS for API calls
- Validate all user inputs

## 📚 Documentation

- **Quick Start**: `ELECTRON_QUICK_START.md`
- **Full Setup**: `ELECTRON_SETUP_GUIDE.md`
- **Troubleshooting**: `ELECTRON_TROUBLESHOOTING.md`
- **Implementation**: `ELECTRON_IMPLEMENTATION_SUMMARY.md`

## 🆘 Need Help?

### Check These First
1. `ELECTRON_TROUBLESHOOTING.md` - Common issues
2. Application logs in `logs/` directory
3. DevTools console (Ctrl+Shift+I)

### Debug Mode
```bash
DEBUG=* npm run electron:dev
```

### Useful Commands
```bash
# Check versions
node --version
npm --version

# Clear cache
npm cache clean --force

# Reinstall
rm -rf node_modules package-lock.json
npm install

# Check ports
netstat -ano | findstr :3000  # Windows
lsof -i :3000                 # macOS
```

## ✨ Next Steps

1. **Immediate**
   - [ ] Install dependencies
   - [ ] Create app icon
   - [ ] Run `npm run electron:dev`

2. **Short Term**
   - [ ] Test all features
   - [ ] Build for your platform
   - [ ] Test installer

3. **Medium Term**
   - [ ] Set up code signing (optional)
   - [ ] Configure auto-updates
   - [ ] Create GitHub release

4. **Long Term**
   - [ ] Distribute to users
   - [ ] Gather feedback
   - [ ] Plan updates

## 🎓 Learning Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [Electron Builder Guide](https://www.electron.build/)
- [Code Signing](https://www.electron.build/code-signing)
- [Auto-Update](https://www.electron.build/auto-update)

## 💡 Pro Tips

1. **Development**: Use `npm run electron:dev` for hot reload
2. **Testing**: Build locally before distribution
3. **Icons**: Use high-quality 512x512 PNG
4. **Signing**: Optional for development, required for distribution
5. **Updates**: Configure for seamless user experience

## 📞 Support

If you get stuck:
1. Read the troubleshooting guide
2. Check the logs
3. Search GitHub issues
4. Create a detailed bug report

---

**Ready to build?** Start with Step 1 above! 🚀

**Questions?** Check `ELECTRON_QUICK_START.md` for common tasks.

**Issues?** See `ELECTRON_TROUBLESHOOTING.md` for solutions.
