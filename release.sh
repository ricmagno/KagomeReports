#!/bin/bash

# ==============================================================================
# KagomeReports Automatic Release & Deploy Script
# Usage: ./release.sh <version> (e.g., ./release.sh 0.79.0)
# ==============================================================================

# Exit on error
set -e

VERSION=$1
REMOTE_USER="scada.sa"
REMOTE_HOST="192.168.235.16"
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

# 2. Update version in package.json
echo "📝 Updating version in package.json..."
sed -i '' "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" package.json

# 3. Update version in Dockerfile labels
if [ -f "Dockerfile" ]; then
    echo "📝 Updating version label in Dockerfile..."
    sed -i '' "s/version=\".*\"/version=\"$VERSION\"/" Dockerfile
fi

# 4. Git commit, tag and push
echo "💾 Committing version changes..."
git add package.json Dockerfile
git commit -m "Chore: Release version $VERSION" || echo "Already up to date"

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

read -p "❓ Do you want to trigger the Kubernetes update now? (y/n): " confirm
if [[ $confirm != [yY] ]]; then
    echo "👋 Release finished. You can run the update later manually on the server."
    exit 0
fi

# 5. Remote Deployment via SSH
echo "🚢 Deploying to Kubernetes cluster at $REMOTE_HOST..."
NEW_IMAGE="ghcr.io/$REPO_NAME:$VERSION"

SSH_CMD="kubectl set image deployment/$DEPLOYMENT $CONTAINER=$NEW_IMAGE -n $NAMESPACE"

echo "📡 Running remote command: $SSH_CMD"
echo "⚠️  IMPORTANT: Please enter your password for $REMOTE_USER@$REMOTE_HOST when prompted below:"
ssh "$REMOTE_USER@$REMOTE_HOST" "$SSH_CMD"

echo "----------------------------------------------------------------------"
echo "🎉 SUCCESS! Version $VERSION has been released and deployed."
echo "🩺 Check status: ssh $REMOTE_USER@$REMOTE_HOST 'kubectl get pods -n $NAMESPACE -w'"
echo "----------------------------------------------------------------------"
