#!/usr/bin/env node

/**
 * Setup script for Electron development
 * Creates necessary directories and files
 */

const fs = require('fs')
const path = require('path')

const dirs = [
  'assets',
  'dist/electron',
  'data',
  'reports',
  'logs'
]

const files = [
  {
    path: 'assets/icon.png',
    message: 'App icon (512x512 PNG) - REQUIRED for building'
  },
  {
    path: '.env.electron',
    message: 'Electron environment configuration'
  }
]

console.log('🔧 Setting up Electron development environment...\n')

// Create directories
console.log('📁 Creating directories...')
dirs.forEach(dir => {
  const fullPath = path.join(__dirname, '..', dir)
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true })
    console.log(`  ✓ Created ${dir}`)
  } else {
    console.log(`  ✓ ${dir} already exists`)
  }
})

// Check files
console.log('\n📄 Checking required files...')
files.forEach(file => {
  const fullPath = path.join(__dirname, '..', file.path)
  if (fs.existsSync(fullPath)) {
    console.log(`  ✓ ${file.path}`)
  } else {
    console.log(`  ⚠ ${file.path} - ${file.message}`)
  }
})

console.log('\n✅ Setup complete!')
console.log('\n📋 Next steps:')
console.log('  1. Create app icon: assets/icon.png (512x512 PNG)')
console.log('  2. Configure environment: .env.electron')
console.log('  3. Run development: npm run electron:dev')
console.log('  4. Build for distribution: npm run electron:build:all')
