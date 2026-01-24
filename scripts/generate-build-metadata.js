#!/usr/bin/env node

/**
 * Generate Build Metadata Script
 * Creates .build-metadata.json with version, build date, commit hash, and branch name
 * Usage: node scripts/generate-build-metadata.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const buildMetadataPath = path.join(__dirname, '..', '.build-metadata.json');

try {
  // Read version from package.json
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const version = packageJson.version;

  // Get build date
  const buildDate = new Date().toISOString();

  // Get commit hash
  let commitHash = 'unknown';
  try {
    commitHash = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch (error) {
    console.warn('Could not get commit hash from git');
  }

  // Get branch name
  let branchName = 'main';
  try {
    branchName = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
  } catch (error) {
    console.warn('Could not get branch name from git');
  }

  // Create build metadata
  const buildMetadata = {
    version,
    buildDate,
    commitHash,
    branchName,
    buildNumber: process.env.BUILD_NUMBER || undefined,
    buildId: process.env.BUILD_ID || undefined,
    generatedAt: new Date().toISOString()
  };

  // Write to file
  fs.writeFileSync(buildMetadataPath, JSON.stringify(buildMetadata, null, 2));

  console.log('✅ Build metadata generated successfully');
  console.log(`   Version: ${version}`);
  console.log(`   Build Date: ${buildDate}`);
  console.log(`   Commit Hash: ${commitHash}`);
  console.log(`   Branch: ${branchName}`);
  console.log(`   File: ${buildMetadataPath}`);
} catch (error) {
  console.error('❌ Failed to generate build metadata:', error.message);
  process.exit(1);
}
