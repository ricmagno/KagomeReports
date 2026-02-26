#!/bin/bash
# ==============================================================================
# KagomeReports Autodeploy Script
# Checks GitHub for a newer version and updates Kubernetes deployment.
# ==============================================================================

REPO="ricmagno/KagomeReports"
NAMESPACE="historian-reports"
DEPLOYMENT="historian-reports"
CONTAINER="historian-reports"
IMAGE_BASE="ghcr.io/ricmagno/kagomereports"

# 1. Get current version in K8s
CURRENT_IMAGE=$(kubectl get deployment $DEPLOYMENT -n $NAMESPACE -o jsonpath='{.spec.template.spec.containers[0].image}')
CURRENT_VERSION=$(echo $CURRENT_IMAGE | cut -d':' -f2)

echo "Current Version: $CURRENT_VERSION"

# 2. Get latest tag from GitHub API
LATEST_TAG=$(curl -s "https://api.github.com/repos/$REPO/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')

if [ -z "$LATEST_TAG" ]; then
    echo "❌ Error: Could not fetch latest tag from GitHub"
    exit 1
fi

echo "Latest Version: $LATEST_TAG"

# 3. Compare and Update
if [ "$CURRENT_VERSION" != "$LATEST_TAG" ]; then
    echo "🚀 New version found! Updating $CURRENT_VERSION -> $LATEST_TAG..."
    
    # Update the deployment
    kubectl set image deployment/$DEPLOYMENT $CONTAINER=$IMAGE_BASE:$LATEST_TAG -n $NAMESPACE
    
    # Wait for rollout
    kubectl rollout status deployment/$DEPLOYMENT -n $NAMESPACE
    
    echo "✅ Successfully updated to $LATEST_TAG"
else
    echo "💤 Already up to date."
fi
