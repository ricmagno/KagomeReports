#!/bin/bash

# ==============================================================================
# KagomeReports Automatic Release & Deploy Script
# Usage: ./release.sh <version> (e.g., ./release.sh 0.79.0)
# ==============================================================================

# Exit on error
set -e

VERSION=$1
REPO_NAME="ricmagno/kagomereports"
NAMESPACE="historian-reports"
DEPLOYMENT="historian-reports"
CONTAINER="historian-reports"

# 1. Validate version argument
if [[ ! $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "❌ Error: Version must be in N.NN.N format (e.g. 0.79.0)"
    echo "Usage: ./release.sh <version>"
    exit 1
fi

echo "🚀 Starting release process for version $VERSION..."

# 2. Update Versions
echo "📝 Updating version in package.json..."
sed -i '' "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" package.json

echo "📝 Updating version label in Dockerfile..."
sed -i '' "s/[[:space:]]*version=\".*\"/    version=\"$VERSION\"/" Dockerfile

echo "📝 Updating version in Kubernetes manifest..."
# Updated path to match current structure
MANIFEST="Kubernetes/historian-reports-deployment.yaml"
if [ -f "$MANIFEST" ]; then
    sed -i '' "s|image: ghcr.io/ricmagno/kagomereports:.*|image: ghcr.io/ricmagno/kagomereports:v$VERSION|" "$MANIFEST"
else
    echo "⚠️ Warning: $MANIFEST not found, skipping manifest update."
fi

# 3. Commit and Tag
echo "💾 Committing version changes..."
git add package.json Dockerfile "$MANIFEST" 2>/dev/null || git add package.json Dockerfile
git commit -m "Chore: Release version $VERSION" --allow-empty

echo "🏷️ Creating git tag $VERSION..."
git tag -d "v$VERSION" 2>/dev/null || true
git tag "v$VERSION"

echo "⬆️ Pushing to GitHub..."
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "   Pushing to current branch: $CURRENT_BRANCH"
git push origin "$CURRENT_BRANCH"

if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "   Syncing with main for autodeploy..."
    git checkout main
    git merge "$CURRENT_BRANCH"
    git push origin main
    git checkout "$CURRENT_BRANCH"
fi

git push origin "v$VERSION" --force

echo "📦 Creating GitHub Release..."
gh release create "v$VERSION" --title "Release v$VERSION" --notes "Automated release for version $VERSION" || echo "⚠️ Release already exists or gh CLI not authenticated"

echo "----------------------------------------------------------------------"
echo "✅ Step 1/2 Complete: Code is pushed and Tag is created."
echo "⌛ GitHub Actions is now building in parallel:"
echo "   - Docker image: Building linux/amd64 and linux/arm64..."
echo "   - Electron app: Building for Windows (.exe) and macOS (.dmg/.zip)..."
echo "   This usually takes 3-5 minutes."
echo "----------------------------------------------------------------------"

echo "----------------------------------------------------------------------"
echo "🎉 SUCCESS! Version $VERSION has been released."
echo "⌛ GitHub Actions is now building AND deploying version $VERSION."
echo "🩺 Watch build/deploy: https://github.com/ricmagno/KagomeReports/actions"
echo "----------------------------------------------------------------------"
