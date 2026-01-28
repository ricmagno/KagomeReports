# 🚀 START HERE - Electron Desktop App Setup

Your Historian Reports app is ready to be packaged as a desktop application. Follow these steps to get started.

## ⚠️ You Got an Error?

If you saw this error:
```
error TS2307: Cannot find module 'electron'
```

**That's normal!** The Electron packages just need to be installed. Follow the steps below.

## 📋 Step 1: Install Dependencies (5 minutes)

Run this command:

```bash
npm install electron electron-builder electron-is-dev wait-on --save-dev --legacy-peer-deps
```

**If it times out**, try this instead:

```bash
npm config set fetch-timeout 120000
npm install --legacy-peer-deps
```

**Still timing out?** See `ELECTRON_INSTALL_GUIDE.md` for more options.

## 🔨 Step 2: Build the Project (2 minutes)

Once installation completes:

```bash
npm run build:all
```

This builds:
- Backend code
- Electron main process
- React frontend

**Expected output:** No errors, files in `dist/` and `client/build/`

## 🎨 Step 3: Create App Icon (1 minute)

Create a 512x512 PNG image and save it as:

```
assets/icon.png
```

(You can use any image for now, or create a proper icon later)

## ▶️ Step 4: Run in Development (1 minute)

```bash
npm run electron:dev
```

**Expected:** Electron window opens with the app running

## 📦 Step 5: Build for Distribution (5 minutes)

### For Windows:
```bash
npm run electron:build:win
```

Creates installers in `dist/electron/`:
- `Historian Reports Setup 0.65.0.exe` (installer)
- `Historian Reports 0.65.0.exe` (portable)

### For macOS:
```bash
npm run electron:build:mac
```

Creates installers in `dist/electron/`:
- `Historian Reports-0.65.0.dmg` (installer)
- `Historian Reports-0.65.0.zip` (archive)

### For Both:
```bash
npm run electron:build:all
```

## ✅ You're Done!

Your desktop app is ready to distribute. Share the `.exe` (Windows) or `.dmg` (macOS) files with users.

## 📚 Documentation

- **Quick reference:** `ELECTRON_QUICK_START.md`
- **Full setup guide:** `ELECTRON_SETUP_GUIDE.md`
- **Troubleshooting:** `ELECTRON_TROUBLESHOOTING.md`
- **Installation help:** `ELECTRON_INSTALL_GUIDE.md`
- **Build fix:** `ELECTRON_BUILD_FIX_SUMMARY.md`
- **Complete index:** `ELECTRON_INDEX.md`

## 🆘 Common Issues

### "npm install times out"
→ See `ELECTRON_INSTALL_GUIDE.md`

### "Build fails with TypeScript errors"
→ See `ELECTRON_QUICK_FIX.md`

### "App won't start"
→ See `ELECTRON_TROUBLESHOOTING.md`

### "How do I customize the app?"
→ See `ELECTRON_SETUP_GUIDE.md`

## 🎯 Quick Commands Reference

```bash
# Development
npm run electron:dev              # Run with hot reload

# Building
npm run electron:build:win        # Windows installer
npm run electron:build:mac        # macOS installer
npm run electron:build:all        # Both platforms

# Utilities
npm run build:all                 # Build everything
npm run build:electron            # Build Electron only
npm run build:client              # Build frontend only
```

## 💡 Pro Tips

1. **Development:** Use `npm run electron:dev` for hot reload
2. **Testing:** Always test on a clean machine before distribution
3. **Icons:** Use high-quality 512x512 PNG for best results
4. **Signing:** Optional for development, recommended for production
5. **Updates:** Configure auto-updates for seamless user experience

## 🎓 Learning Path

**First time?**
1. Follow steps 1-4 above
2. Read `ELECTRON_QUICK_START.md`
3. Read `ELECTRON_SETUP_GUIDE.md`

**Ready to distribute?**
1. Follow step 5 above
2. Test on clean machine
3. Share the installer files

**Need advanced features?**
1. Read `ELECTRON_SETUP_GUIDE.md` → Code Signing
2. Read `ELECTRON_SETUP_GUIDE.md` → Auto-Updates
3. Read `ELECTRON_TROUBLESHOOTING.md` → Performance

## 📞 Need Help?

1. **Quick issue?** → `ELECTRON_QUICK_FIX.md`
2. **Installation problem?** → `ELECTRON_INSTALL_GUIDE.md`
3. **How to do X?** → `ELECTRON_QUICK_START.md`
4. **Detailed guide?** → `ELECTRON_SETUP_GUIDE.md`
5. **Troubleshooting?** → `ELECTRON_TROUBLESHOOTING.md`

## ✨ What's Included

✅ Electron main process
✅ Secure IPC communication
✅ Windows installer (NSIS)
✅ Windows portable executable
✅ macOS DMG installer
✅ macOS ZIP archive
✅ Code signing support
✅ Auto-update capability
✅ DevTools integration
✅ Hot reload in development

## 🎉 Ready?

Run this now:

```bash
npm install electron electron-builder electron-is-dev wait-on --save-dev --legacy-peer-deps
```

Then:

```bash
npm run build:all
npm run electron:dev
```

---

**Questions?** Check the documentation files above.

**Stuck?** See `ELECTRON_INSTALL_GUIDE.md` or `ELECTRON_QUICK_FIX.md`.

**Ready to build?** Run `npm run electron:build:all` after step 4.

**Good luck! 🚀**
