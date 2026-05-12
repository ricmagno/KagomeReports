# Deployment Specification

This document defines the authoritative deployment patterns for Historian Reports.

## 🐳 Docker Deployment
The application uses a multi-stage Dockerfile optimized for security and multi-architecture builds (AMD64 and ARM64).

### Build Strategy
- **Base Image**: `node:20-bookworm-slim`.
- **User**: Runs as non-root user `historian` (UID 1001).
- **Stages**: 
  1. `backend-builder`: Compiles TypeScript.
  2. `client-builder`: Builds React frontend.
  3. `prod-deps`: Prepares production-only `node_modules`.
  4. `production`: Final small-footprint image.
- **Persistence**: Requires volumes for `/app/data`, `/app/reports`, and `/app/logs`.

## ☸️ Kubernetes Deployment
Deployment manifests are located in the `/Kubernetes` directory.

### Core Components
- **Namespace**: `historian-reports` (defined in `historian-reports-namespace.yaml`).
- **Workload**: `Deployment` (3 replicas by default) with an associated `HPA` for auto-scaling.
- **Networking**: 
  - `Service`: Standard ClusterIP.
  - `Ingress`: NGINX-based ingress for external access.
- **Configuration**: Uses `Secrets` and `ConfigMaps` for environment variables.

### Auto-Deployment
The repository includes automated CI/CD patterns in `.github/workflows/docker-publish.yml` that push images to GitHub Container Registry (GHCR).

## 🐕 Autodeploy Watchdog
The system implements a "Pull-based" continuous deployment strategy via a systemd-controlled script on the host server.

- **Component**: `Kubernetes/autodeploy/autodeploy.sh`.
- **Logic**: Polls GitHub API for the `latest` release tag and compares it to the running image version.
- **Trigger**: `historian-autodeploy.timer` runs every 5 minutes.
- **Authoritative Guide**: [Docs/KUBERNETES_SETUP_INSTRUCTIONS.md](../Docs/KUBERNETES_SETUP_INSTRUCTIONS.md).

## 🌍 Environment Variables (Containerized)
In addition to standard `.env` variables, the following are crucial for containers:
- `IS_DOCKER=true`: Enables specific logging and path logic for container environments.
- `DATA_DIR`, `REPORTS_DIR`, `LOG_FILE`: Points to persistent volume mounts.
