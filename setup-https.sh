#!/bin/bash

# HTTPS Setup Script for reports.kagome.com.au
# This script sets up Nginx reverse proxy with Let's Encrypt SSL

set -e

echo "=== Setting up HTTPS for reports.kagome.com.au ==="

# Update system packages
echo "Updating system packages..."
sudo apt update

# Install Nginx
echo "Installing Nginx..."
sudo apt install -y nginx

# Install Certbot and Nginx plugin
echo "Installing Certbot..."
sudo apt install -y certbot python3-certbot-nginx

# Stop Nginx temporarily for initial setup
sudo systemctl stop nginx

# Create Nginx configuration directory if it doesn't exist
sudo mkdir -p /etc/nginx/sites-available
sudo mkdir -p /etc/nginx/sites-enabled

# Remove default Nginx site
sudo rm -f /etc/nginx/sites-enabled/default

echo "=== Nginx and Certbot installation complete ==="
echo "Next: Create the Nginx configuration file"