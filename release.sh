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
# Use a more flexible regex for JSON to handle spaces
sed -i '' "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" package.json

echo "📝 Updating version label in Dockerfile..."
# Match anything starting with 'version=' including spaces
sed -i '' "s/[[:space:]]*version=\".*\"/    version=\"$VERSION\"/" Dockerfile

echo "📝 Updating version in Kubernetes manifest..."
sed -i '' "s|image: ghcr.io/ricmagno/kagomereports:.*|image: ghcr.io/ricmagno/kagomereports:$VERSION|" Kubernets/historian-reports-deployment.yaml

# 3. Commit and Tag
echo "💾 Committing version changes..."
git add package.json Dockerfile Kubernets/historian-reports-deployment.yaml
git commit -m "Chore: Release version $VERSION"

echo "🏷️ Creating git tag $VERSION..."
git tag -d "$VERSION" 2>/dev/null || true
git tag "$VERSION"

echo "⬆️ Pushing to GitHub (this triggers the Docker build)..."
git push origin mobile
git push origin "$VERSION" --force

echo "📦 Creating GitHub Release..."
gh release create "$VERSION" --title "Release $VERSION" --notes "Automated release for version $VERSION" || echo "⚠️ Release already exists or gh CLI not authenticated"

echo "----------------------------------------------------------------------"
echo "✅ Step 1/2 Complete: Code is pushed and Tag is created."
echo "⌛ GitHub Actions is now building the Docker image for $VERSION."
echo "   This usually takes 2-4 minutes."
echo "----------------------------------------------------------------------"

echo "----------------------------------------------------------------------"
echo "🎉 SUCCESS! Version $VERSION has been released."
echo "⌛ GitHub Actions is now building AND deploying version $VERSION."
echo "🩺 Watch build/deploy: https://github.com/ricmagno/KagomeReports/actions"
echo "----------------------------------------------------------------------"
