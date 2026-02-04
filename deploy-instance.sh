#!/bin/bash

# Script to deploy a new historian-reports instance
# Usage: ./deploy-instance.sh <instance-name> <node-port>
# Example: ./deploy-instance.sh plant1 30001

if [ $# -ne 2 ]; then
    echo "Usage: $0 <instance-name> <node-port>"
    echo "Example: $0 plant1 30001"
    exit 1
fi

INSTANCE_NAME=$1
NODE_PORT=$2
PORT_NUMBER=$((NODE_PORT - 30000 + 3001))

echo "Deploying historian-reports instance: $INSTANCE_NAME"
echo "Node Port: $NODE_PORT"
echo "CORS Origin Port: $PORT_NUMBER"

# Create instance-specific deployment
sed "s/INSTANCE_NAME/$INSTANCE_NAME/g; s/PORT_NUMBER/$PORT_NUMBER/g" k8s-manifests/05-deployment-template.yaml > k8s-manifests/deployment-$INSTANCE_NAME.yaml

# Create instance-specific service
sed "s/INSTANCE_NAME/$INSTANCE_NAME/g; s/NODE_PORT/$NODE_PORT/g" k8s-manifests/06-service-template.yaml > k8s-manifests/service-$INSTANCE_NAME.yaml

# Apply the manifests
kubectl apply -f k8s-manifests/deployment-$INSTANCE_NAME.yaml
kubectl apply -f k8s-manifests/service-$INSTANCE_NAME.yaml

echo "Instance $INSTANCE_NAME deployed successfully!"
echo "Access URL: http://$(hostname -I | awk '{print $1}'):$NODE_PORT"
echo ""
echo "To check status:"
echo "kubectl get pods -n historian-reports -l instance=$INSTANCE_NAME"
echo "kubectl logs -n historian-reports -l instance=$INSTANCE_NAME"