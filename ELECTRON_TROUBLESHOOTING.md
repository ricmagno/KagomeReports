# Electron Desktop App - Troubleshooting Guide

## Common Issues and Solutions

### 🔴 App Won't Start

#### Issue: "Cannot find module 'electron'"
**Solution:**
```bash
npm install electron --save-dev
```

#### Issue: "Port 3000 already in use"
**Solution:**

Windows:
```bash
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

macOS/Linux:
```bash
lsof -i :3000
kill -9 <PID>
```

Or use a different port:
```bash
PORT=3001 npm run electron:dev
```

#### Issue: "Backend server not starting"
**Solution:**
1. Check if Node.js is installed: `node --version`
2. Check if dependencies are installed: `npm install`
3. Check logs in `logs/` directory
4. Try running backend separately: `npm run dev`

### 🔴 Build Fails

#### Issue: "Cannot find module 'electron-builder'"
**Solution:**
```bash
npm install electron-builder --save-dev
```

#### Issue: "dist/electron/main.js not found"
**Solution:**
```bash
npm run build
npm run electron:build:all
```

#### Issue: "Icon file not found"
**Solution:**
1. Create `assets/` directory: `mkdir assets`
2. Add icon file: `assets/icon.png` (512x512 PNG)
3. Rebuild: `npm run electron:build:all`

#### Issue: "Build fails on macOS with code signing error"
**Solution:**
```bash
# Skip code signing for development
export CSC_IDENTITY_AUTO_DISCOVERY=false
npm run electron:build:mac
```

### 🔴 Windows Build Issues

#### Issue: "NSIS installer creation failed"
**Solution:**
1. Ensure NSIS is installed (electron-builder should handle this)
2. Try portable build instead:
   ```bash
   npm run electron:build:win
   ```
3. Check for special characters in app name

#### Issue: "Antivirus blocks installer"
**Solution:**
1. Temporarily disable antivirus during build
2. Code sign the installer (requires certificate)
3. Submit to antivirus vendor for whitelisting

#### Issue: "Installer won't run on target machine"
**Solution:**
1. Ensure target has .NET Framework installed
2. Try portable executable instead
3. Check Windows version compatibility

### 🔴 macOS Build Issues

#### Issue: "Code signing failed"
**Solution:**
```bash
# Skip code signing for development
export CSC_IDENTITY_AUTO_DISCOVERY=false
npm run electron:build:mac
```

#### Issue: "App won't run on other Macs"
**Solution:**
1. Ensure app is notarized for distribution
2. Check macOS version compatibility
3. Verify code signing certificate is valid

#### Issue: "DMG creation failed"
**Solution:**
1. Check disk space (need ~1GB free)
2. Try ZIP build instead:
   ```bash
   npm run electron:build:mac
   ```

### 🔴 Development Issues

#### Issue: "Hot reload not working"
**Solution:**
1. Ensure both servers are running:
   ```bash
   npm run electron:dev
   ```
2. Check that frontend changes are detected
3. Restart Electron: `Ctrl+R` or `Cmd+R`

#### Issue: "DevTools won't open"
**Solution:**
1. Press `Ctrl+Shift+I` (Windows) or `Cmd+Option+I` (macOS)
2. Or enable in main.ts:
   ```typescript
   if (isDevelopment) {
     mainWindow.webContents.openDevTools()
   }
   ```

#### Issue: "Backend changes not reflected"
**Solution:**
1. Ensure `npm run dev` is running
2. Check that TypeScript compilation succeeds
3. Restart Electron window

### 🔴 Runtime Issues

#### Issue: "App crashes on startup"
**Solution:**
1. Check logs in application data directory:
   - Windows: `%APPDATA%\Historian Reports\logs\`
   - macOS: `~/Library/Application Support/Historian Reports/logs/`
2. Check console output for errors
3. Verify database connection settings

#### Issue: "Database connection fails"
**Solution:**
1. Verify database is running and accessible
2. Check connection string in `.env`
3. Test connection: `npm run test:db`
4. Check firewall settings

#### Issue: "Reports won't generate"
**Solution:**
1. Check reports directory exists and is writable
2. Verify disk space available
3. Check logs for specific errors
4. Ensure database has data

#### Issue: "Memory usage keeps growing"
**Solution:**
1. Check for memory leaks in services
2. Monitor with DevTools: `Ctrl+Shift+I`
3. Restart app periodically
4. Check for large data operations

### 🔴 Distribution Issues

#### Issue: "Users can't install on their machines"
**Solution:**
1. Test on clean machine before distribution
2. Ensure all dependencies are bundled
3. Check Windows/macOS version requirements
4. Provide system requirements documentation

#### Issue: "App won't update automatically"
**Solution:**
1. Configure auto-update service
2. Set up GitHub releases
3. Check update checker logs
4. Verify network connectivity

#### Issue: "Installer is too large"
**Solution:**
1. Remove unnecessary dependencies
2. Use tree-shaking in build
3. Compress assets
4. Consider splitting into separate installers

### 🟡 Performance Issues

#### Issue: "App is slow to start"
**Solution:**
1. Profile startup time with DevTools
2. Lazy load modules
3. Optimize database queries
4. Reduce bundle size

#### Issue: "Charts render slowly"
**Solution:**
1. Reduce data points displayed
2. Use data sampling
3. Implement virtualization
4. Profile with DevTools

#### Issue: "High memory usage"
**Solution:**
1. Monitor with DevTools
2. Check for memory leaks
3. Implement data pagination
4. Clear caches periodically

### 🟡 Security Issues

#### Issue: "App fails security scan"
**Solution:**
1. Enable code signing
2. Use HTTPS for API calls
3. Implement proper authentication
4. Validate all user inputs
5. Use secure storage for credentials

#### Issue: "Antivirus flags app as malware"
**Solution:**
1. Code sign the application
2. Submit to antivirus vendor
3. Use legitimate certificate
4. Avoid suspicious patterns in code

## Debug Mode

### Enable Debug Logging

Set environment variable:
```bash
DEBUG=historian:* npm run electron:dev
```

### Check Application Logs

**Windows:**
```
%APPDATA%\Historian Reports\logs\
```

**macOS:**
```
~/Library/Application Support/Historian Reports/logs/
```

### View Electron Logs

Press `Ctrl+Shift+I` (Windows) or `Cmd+Option+I` (macOS) to open DevTools.

## Getting Help

1. Check this troubleshooting guide
2. Review `ELECTRON_SETUP_GUIDE.md`
3. Check application logs
4. Search GitHub issues
5. Create detailed bug report with:
   - OS and version
   - Node.js version
   - Steps to reproduce
   - Error messages
   - Logs

## Useful Commands

```bash
# Check Node.js version
node --version

# Check npm version
npm --version

# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Check for port usage
netstat -ano | findstr :3000  # Windows
lsof -i :3000                 # macOS/Linux

# View application data
# Windows: %APPDATA%\Historian Reports\
# macOS: ~/Library/Application Support/Historian Reports/

# Run with debug output
DEBUG=* npm run electron:dev

# Build with verbose output
npm run electron:build:all -- --verbose
```

## Still Having Issues?

1. **Check the logs** - Most issues are logged
2. **Search existing issues** - Your problem might be solved
3. **Create a minimal reproduction** - Helps identify the issue
4. **Provide system information** - OS, Node.js version, etc.
5. **Include error messages** - Full stack traces are helpful

---

**Last Updated:** January 2026
**Electron Version:** 31.0.0
**Electron Builder Version:** 25.0.0
