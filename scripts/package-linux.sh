#!/bin/bash

# ==============================================================================
# Historian Reports - Linux Packaging Script
# Creates a distribution tarball for Linux installations
# ==============================================================================

# Exit on error
set -e

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")
DIST_NAME="historian-reports-v$VERSION"
OUTPUT_DIR="linux-dist"

echo "Packaging $DIST_NAME..."

# 1. Clean and build
echo "Building components..."
npm run build
npm run build:client

# 2. Prepare distribution directory
echo "Preparing $OUTPUT_DIR..."
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

# 3. Copy files
echo "Copying files..."
cp -r dist "$OUTPUT_DIR/"
mkdir -p "$OUTPUT_DIR/client"
cp -r client/build "$OUTPUT_DIR/client/"
cp -r templates "$OUTPUT_DIR/"
cp package.json "$OUTPUT_DIR/"
cp package-lock.json "$OUTPUT_DIR/"
cp scripts/install-ubuntu.sh "$OUTPUT_DIR/"

# 4. Create tarball
echo "Creating tarball..."
mkdir -p dist/packages
tar -czf "dist/packages/$DIST_NAME.tar.gz" -C "$OUTPUT_DIR" .

echo "===================================================="
echo "Package created: dist/packages/$DIST_NAME.tar.gz"
echo "===================================================="
rm -rf "$OUTPUT_DIR"
