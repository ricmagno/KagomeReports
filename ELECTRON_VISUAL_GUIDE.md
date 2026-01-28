# Electron Desktop App - Visual Guide

## 🎯 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    ELECTRON APPLICATION                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              MAIN PROCESS (main.ts)                  │   │
│  │  • Creates window                                    │   │
│  │  • Manages app lifecycle                            │   │
│  │  • Starts backend server                            │   │
│  │  • Handles IPC communication                        │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↕                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         RENDERER PROCESS (React Frontend)            │   │
│  │  • React components                                  │   │
│  │  • User interface                                    │   │
│  │  • Communicates via IPC                             │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↕                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │      PRELOAD SCRIPT (preload.ts)                     │   │
│  │  • Secure IPC bridge                                │   │
│  │  • Exposes safe APIs                                │   │
│  │  • Context isolation                                │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↕                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │      BACKEND PROCESS (Express Server)                │   │
│  │  • API endpoints                                     │   │
│  │  • Database connections                             │   │
│  │  • Business logic                                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## 📦 Build Process

```
SOURCE CODE
    ↓
┌─────────────────────────────────────────┐
│  npm run build:all                      │
│  • Compile TypeScript (backend)         │
│  • Build React (frontend)               │
└─────────────────────────────────────────┘
    ↓
COMPILED CODE
    ↓
┌─────────────────────────────────────────┐
│  npm run electron:build:*               │
│  • Package with Electron                │
│  • Create installers                    │
│  • Sign (optional)                      │
└─────────────────────────────────────────┘
    ↓
DISTRIBUTION PACKAGES
    ├─ Windows: .exe installer
    ├─ Windows: Portable .exe
    ├─ macOS: .dmg installer
    └─ macOS: .zip archive
```

## 🚀 Development Workflow

```
┌──────────────────────────────────────────────────────────┐
│  npm run electron:dev                                    │
└──────────────────────────────────────────────────────────┘
    ↓
    ├─ Start Express backend (port 3000)
    ├─ Start React dev server (port 3000)
    └─ Launch Electron window
    ↓
┌──────────────────────────────────────────────────────────┐
│  DEVELOPMENT ENVIRONMENT READY                           │
│  • DevTools open                                         │
│  • Hot reload enabled                                    │
│  • Backend auto-restart on changes                       │
│  • Frontend auto-reload on changes                       │
└──────────────────────────────────────────────────────────┘
    ↓
    ├─ Edit backend code → Auto-restart
    ├─ Edit frontend code → Auto-reload
    └─ Press Ctrl+R to reload Electron
```

## 📁 File Organization

```
historian-reports/
│
├── 📂 src/
│   ├── 📂 electron/
│   │   ├── main.ts          ← Electron main process
│   │   └── preload.ts       ← IPC bridge
│   ├── server.ts            ← Express backend
│   └── ...
│
├── 📂 client/
│   ├── 📂 src/
│   │   ├── App.tsx          ← React app
│   │   └── ...
│   └── package.json
│
├── 📂 assets/
│   ├── icon.png             ← App icon (required)
│   ├── icon.ico             ← Windows icon (optional)
│   ├── icon.icns            ← macOS icon (optional)
│   └── entitlements.mac.plist
│
├── 📂 scripts/
│   ├── build-electron.sh    ← Unix build script
│   ├── build-electron.bat   ← Windows build script
│   └── setup-electron.js    ← Setup helper
│
├── 📂 .github/workflows/
│   └── electron-build.yml   ← CI/CD automation
│
├── electron.js              ← Electron entry point
├── package.json             ← Updated with Electron config
└── ELECTRON_*.md            ← Documentation
```

## 🔄 Data Flow

```
USER INTERACTION
    ↓
React Component
    ↓
IPC Message (preload.ts)
    ↓
Main Process (main.ts)
    ↓
Express Backend (server.ts)
    ↓
Database / File System
    ↓
Response back through same path
    ↓
React Component Updates
    ↓
UI Renders
```

## 🛠️ Build Commands Reference

```
┌─────────────────────────────────────────────────────────┐
│ DEVELOPMENT                                             │
├─────────────────────────────────────────────────────────┤
│ npm run electron:dev                                    │
│ → Starts dev environment with hot reload               │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ BUILDING                                                │
├─────────────────────────────────────────────────────────┤
│ npm run electron:build:win                              │
│ → Creates Windows installer and portable executable    │
│                                                         │
│ npm run electron:build:mac                              │
│ → Creates macOS DMG and ZIP                            │
│                                                         │
│ npm run electron:build:all                              │
│ → Creates installers for both platforms                │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ UTILITIES                                               │
├─────────────────────────────────────────────────────────┤
│ npm run build                                           │
│ → Compile backend TypeScript                           │
│                                                         │
│ npm run build:client                                    │
│ → Build React frontend                                 │
│                                                         │
│ npm run build:all                                       │
│ → Build both backend and frontend                      │
└─────────────────────────────────────────────────────────┘
```

## 📊 Platform Comparison

```
┌──────────────────────────────────────────────────────────┐
│                    WINDOWS                               │
├──────────────────────────────────────────────────────────┤
│ Installer:  Historian Reports Setup 0.65.0.exe          │
│ Portable:   Historian Reports 0.65.0.exe                │
│ Arch:       x64, ia32 (32-bit)                          │
│ Size:       ~400MB                                       │
│ Install:    Custom directory selection                  │
│ Shortcuts:  Desktop + Start Menu                        │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                     macOS                                │
├──────────────────────────────────────────────────────────┤
│ Installer:  Historian Reports-0.65.0.dmg                │
│ Archive:    Historian Reports-0.65.0.zip                │
│ Arch:       Universal (Intel + Apple Silicon)           │
│ Size:       ~400MB                                       │
│ Install:    Drag to Applications                        │
│ Signing:    Optional (required for distribution)        │
└──────────────────────────────────────────────────────────┘
```

## 🔐 Security Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  SECURITY LAYERS                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Layer 1: Context Isolation                             │
│  ├─ Renderer process isolated from main                 │
│  └─ No direct access to Node.js APIs                    │
│                                                          │
│  Layer 2: Sandbox                                       │
│  ├─ Renderer runs in restricted environment             │
│  └─ Limited file system access                          │
│                                                          │
│  Layer 3: Secure IPC                                    │
│  ├─ Preload script validates messages                   │
│  └─ Only safe APIs exposed                              │
│                                                          │
│  Layer 4: Code Signing                                  │
│  ├─ Windows: Authenticode signing                       │
│  └─ macOS: Developer certificate signing                │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## 📈 Performance Profile

```
STARTUP TIME
├─ Electron launch:     ~500ms
├─ Backend start:       ~1000ms
├─ React load:         ~1000ms
└─ Total:              ~2500ms (2.5 seconds)

MEMORY USAGE
├─ Electron process:    ~100MB
├─ Backend process:     ~50MB
├─ React app:          ~50MB
└─ Total:              ~200MB (typical)

DISK SPACE
├─ Application:        ~400MB
├─ Data directory:     ~100MB (varies)
└─ Total:              ~500MB (minimum)
```

## 🔄 Update Flow

```
USER LAUNCHES APP
    ↓
CHECK FOR UPDATES
    ↓
NEW VERSION AVAILABLE?
    ├─ YES → Download update
    │        ↓
    │        Install update
    │        ↓
    │        Restart app
    │
    └─ NO → Continue normally
```

## 📚 Documentation Map

```
START HERE
    ↓
ELECTRON_GETTING_STARTED.md
├─ Pre-flight checklist
├─ Step-by-step setup
└─ Common tasks
    ↓
ELECTRON_QUICK_START.md
├─ 5-minute quick start
├─ Build commands
└─ Troubleshooting tips
    ↓
ELECTRON_SETUP_GUIDE.md
├─ Detailed setup
├─ Code signing
├─ Auto-updates
└─ Performance
    ↓
ELECTRON_TROUBLESHOOTING.md
├─ Common issues
├─ Solutions
└─ Debug mode
    ↓
ELECTRON_IMPLEMENTATION_SUMMARY.md
├─ Technical details
├─ Architecture
└─ Configuration
```

## 🎯 Quick Decision Tree

```
What do you want to do?
│
├─ Get started quickly?
│  └─ Read: ELECTRON_GETTING_STARTED.md
│
├─ Run in development?
│  └─ Run: npm run electron:dev
│
├─ Build for distribution?
│  ├─ Windows? → npm run electron:build:win
│  ├─ macOS?   → npm run electron:build:mac
│  └─ Both?    → npm run electron:build:all
│
├─ Something not working?
│  └─ Check: ELECTRON_TROUBLESHOOTING.md
│
├─ Need detailed setup?
│  └─ Read: ELECTRON_SETUP_GUIDE.md
│
└─ Want technical details?
   └─ Read: ELECTRON_IMPLEMENTATION_SUMMARY.md
```

## ✅ Verification Checklist

```
BEFORE DEVELOPMENT:
  ☐ Node.js 18+ installed
  ☐ npm installed
  ☐ Dependencies installed (npm install)
  ☐ App icon created (assets/icon.png)

BEFORE BUILDING:
  ☐ Backend compiles (npm run build)
  ☐ Frontend builds (npm run build:client)
  ☐ Development works (npm run electron:dev)
  ☐ No console errors

BEFORE DISTRIBUTION:
  ☐ Tested on clean machine
  ☐ All features work
  ☐ No missing dependencies
  ☐ Code signed (optional but recommended)
  ☐ Version updated
```

---

**Visual Guide Complete** ✨

For more details, see the comprehensive documentation files.
