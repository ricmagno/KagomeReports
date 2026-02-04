# Kubernetes Deployment - KagomeReports

This directory contains the manifests for deploying the Historian Reports application to a Kubernetes cluster.

## Setup Instructions

### 1. Configure Namespace
Apply the namespace manifest:
```bash
kubectl apply -f historian-reports-namespace.yaml
```

### 2. Configure GHCR Access (imagePullSecret)
To pull images from the GitHub Container Registry, you must create a secret with a GitHub Personal Access Token (PAT).

1. Generate a PAT with `read:packages` permissions.
2. Run the following command:
```bash
kubectl create secret docker-registry ghcr-regcred \
  --docker-server=ghcr.io \
  --docker-username=YOUR_GITHUB_USERNAME \
  --docker-password=YOUR_GITHUB_TOKEN \
  --docker-email=YOUR_EMAIL \
  -n historian-reports
```

### 3. Apply Environment Secrets
Update `historian-reports-secret.yaml` with your actual database credentials and other secrets, then apply it:
```bash
kubectl apply -f historian-reports-secret.yaml
```

### 4. Deploy the Application
```bash
kubectl apply -f historian-reports-deployment.yaml
kubectl apply -f historian-reports-service.yaml
kubectl apply -f historian-reports-hpa.yaml
```

## Seamless Updates
The deployment is configured to use the latest image from GHCR. For future updates:
1. Push a new tag to the repository (e.g., `0.79.0`). 
2. The GitHub Action will automatically build and push the image.
3. Update the version in `historian-reports-deployment.yaml` and re-apply:
```bash
kubectl apply -f historian-reports-deployment.yaml
```
Kubernetes will perform a rolling update automatically.
