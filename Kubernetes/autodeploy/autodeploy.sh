#!/bin/bash
# ==============================================================================
# KagomeReports Autodeploy Script
# Checks GitHub for a newer version and updates Kubernetes deployment.
# ==============================================================================

# Ensure PATH includes standard system locations
export PATH=$PATH:/usr/local/bin:/usr/bin:/bin:/snap/bin

# Ensure KUBECONFIG is set for systemd execution context
if [ -z "$KUBECONFIG" ]; then
    if [ -f "$HOME/.kube/config" ]; then
        export KUBECONFIG="$HOME/.kube/config"
    elif [ -f "/home/scada.sa/.kube/config" ]; then
        export KUBECONFIG="/home/scada.sa/.kube/config"
    elif [ -f "/etc/kubernetes/admin.conf" ]; then
        export KUBECONFIG="/etc/kubernetes/admin.conf"
    fi
fi

REPO="ricmagno/KagomeReports"
NAMESPACE="historian-reports"
DEPLOYMENT="historian-reports"
CONTAINER="historian-reports"
IMAGE_BASE="ghcr.io/ricmagno/kagomereports"

# 1. Get current version in K8s safely
CURRENT_IMAGE=$(kubectl get deployment $DEPLOYMENT -n $NAMESPACE -o jsonpath='{.spec.template.spec.containers[0].image}' 2>/dev/null)
if [ $? -ne 0 ] || [ -z "$CURRENT_IMAGE" ]; then
    echo "❌ Error: Failed to communicate with Kubernetes cluster or deployment '$DEPLOYMENT' not found."
    exit 1
fi

CURRENT_VERSION=$(echo $CURRENT_IMAGE | cut -d':' -f2)
echo "Current Version: $CURRENT_VERSION"

# 2. Get latest tag from GitHub API (support optional GITHUB_TOKEN to bypass anonymous rate limits)
AUTH_HEADER=""
if [ -n "$GITHUB_TOKEN" ]; then
    AUTH_HEADER="-H \"Authorization: token $GITHUB_TOKEN\""
fi

LATEST_TAG=$(eval curl -s $AUTH_HEADER "https://api.github.com/repos/$REPO/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')

if [ -z "$LATEST_TAG" ]; then
    echo "❌ Error: Could not fetch latest tag from GitHub API (Rate limit exceeded or no releases found)."
    exit 1
fi

echo "Latest Version: $LATEST_TAG"

# Normalize tag prefixes for reliable comparison (e.g. comparing 1.2.17 vs v1.2.23)
NORM_CURRENT="${CURRENT_VERSION#v}"
NORM_LATEST="${LATEST_TAG#v}"

# 3. Compare and Update
if [ "$NORM_CURRENT" != "$NORM_LATEST" ]; then
    echo "🚀 New version found! Updating $CURRENT_VERSION -> $LATEST_TAG..."
    
    # Update the deployment image tag
    kubectl set image deployment/$DEPLOYMENT $CONTAINER=$IMAGE_BASE:$LATEST_TAG -n $NAMESPACE
    
    # Wait for rollout completion
    kubectl rollout status deployment/$DEPLOYMENT -n $NAMESPACE
    
    echo "✅ Successfully updated to $LATEST_TAG"
else
    echo "💤 Already up to date."
fi
