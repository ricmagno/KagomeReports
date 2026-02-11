#!/bin/bash

# Script to update all historian-reports instances to a new image version
# Usage: ./update-all-instances.sh <new-image-tag>
# Example: ./update-all-instances.sh 0.78.0

if [ $# -ne 1 ]; then
    echo "Usage: $0 <new-image-tag>"
    echo "Example: $0 0.78.0"
    exit 1
fi

NEW_TAG=$1
IMAGE_NAME="historian-reports:$NEW_TAG"

echo "Updating all historian-reports instances to $IMAGE_NAME"

# Get all deployments in the historian-reports namespace
DEPLOYMENTS=$(kubectl get deployments -n historian-reports -o jsonpath='{.items[*].metadata.name}')

if [ -z "$DEPLOYMENTS" ]; then
    echo "No deployments found in historian-reports namespace"
    exit 1
fi

for DEPLOYMENT in $DEPLOYMENTS; do
    echo "Updating deployment: $DEPLOYMENT"
    kubectl set image deployment/$DEPLOYMENT historian-reports=$IMAGE_NAME -n historian-reports
    
    # Wait for rollout to complete
    kubectl rollout status deployment/$DEPLOYMENT -n historian-reports --timeout=300s
    
    if [ $? -eq 0 ]; then
        echo "✓ $DEPLOYMENT updated successfully"
    else
        echo "✗ Failed to update $DEPLOYMENT"
    fi
done

echo ""
echo "Update complete! Checking pod status:"
kubectl get pods -n historian-reports