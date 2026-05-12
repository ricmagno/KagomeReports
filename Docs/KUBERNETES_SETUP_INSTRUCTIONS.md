# Kubernetes & Autodeploy Setup Instructions

This document provides the authoritative instructions for deploying Historian Reports to a production Kubernetes cluster and setting up the automated deployment "Watchdog".

> [!NOTE]
> This guide focuses on **how** to deploy. For the **authoritative specification** of the deployment architecture, see [spec/deployment.md](../spec/deployment.md).

## 🏗️ Production Cluster Setup

The production environment typically runs on a Linux server (e.g., SCADA server).

### 1. Prerequisite: Cluster Access
Ensure `kubectl` is installed and configured to point to your production cluster.

### 2. Manual Deployment
Follow the steps in [Kubernetes/README.md](../Kubernetes/README.md) to:
- Create the `historian-reports` namespace.
- Configure `ghcr-regcred` secret for GitHub Container Registry access.
- Apply environment secrets and manifests.

---

## 🚀 Automated Deployment (The Watchdog)

The system includes a "pull-based" autodeploy mechanism. A systemd timer on the host server polls GitHub for new releases and updates the Kubernetes deployment automatically.

### 1. How it Works
The script `Kubernetes/autodeploy/autodeploy.sh`:
1. Checks the current image tag in the Kubernetes deployment.
2. Queries the GitHub API for the latest release tag.
3. If a newer tag is found, it runs `kubectl set image` to trigger a rolling update.

### 2. Host Installation (SCADA Server)
To install the watchdog on your server:

```bash
# 1. Copy autodeploy files to the server
scp -r Kubernetes/autodeploy user@your-server:~/

# 2. Install the script to system path
sudo cp ~/autodeploy/autodeploy.sh /usr/local/bin/autodeploy.sh
sudo chmod +x /usr/local/bin/autodeploy.sh

# 3. Install systemd service and timer
sudo cp ~/autodeploy/historian-autodeploy.* /etc/systemd/system/

# 4. Enable the timer
sudo systemctl daemon-reload
sudo systemctl enable --now historian-autodeploy.timer
```

### 3. Monitoring
Check the status of the automated checks:
```bash
# View timer status
systemctl status historian-autodeploy.timer

# View logs of the last check
journalctl -u historian-autodeploy.service
```

## 🔄 Release Workflow
1.  **Tag & Push**: Create a new version tag (e.g., `v1.2.21`) and push to GitHub.
2.  **GitHub Action**: GitHub builds and pushes the image to `ghcr.io/ricmagno/kagomereports`.
3.  **Watchdog**: Within 5 minutes, the server identifies the new version and updates the cluster.