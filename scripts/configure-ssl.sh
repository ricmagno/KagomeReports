#!/bin/bash

# SSL Configuration Script for reports.kagome.com.au
# Run this after the initial setup script

set -e

echo "=== Configuring SSL for reports.kagome.com.au ==="

# Copy the Nginx configuration
echo "Installing Nginx configuration..."
sudo cp nginx-reports-config.conf /etc/nginx/sites-available/reports.kagome.com.au

# Enable the site
echo "Enabling the site..."
sudo ln -sf /etc/nginx/sites-available/reports.kagome.com.au /etc/nginx/sites-enabled/

# Test Nginx configuration
echo "Testing Nginx configuration..."
sudo nginx -t

# Start Nginx
echo "Starting Nginx..."
sudo systemctl start nginx
sudo systemctl enable nginx

# Check if the domain resolves to this server
echo "Checking DNS resolution..."
if ! nslookup reports.kagome.com.au | grep -q "192.168.235.16"; then
    echo "WARNING: DNS may not be properly configured."
    echo "Make sure reports.kagome.com.au points to 192.168.235.16"
    echo "You can continue, but SSL certificate generation may fail."
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Obtain SSL certificate
echo "Obtaining SSL certificate from Let's Encrypt..."
sudo certbot --nginx -d reports.kagome.com.au --non-interactive --agree-tos --email admin@kagome.com.au

# Test certificate renewal
echo "Testing certificate renewal..."
sudo certbot renew --dry-run

# Setup automatic renewal
echo "Setting up automatic certificate renewal..."
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# Check firewall status
echo "Checking firewall configuration..."
if command -v ufw &> /dev/null; then
    echo "UFW firewall detected. Configuring rules..."
    sudo ufw allow 'Nginx Full'
    sudo ufw allow ssh
    sudo ufw --force enable
elif command -v firewall-cmd &> /dev/null; then
    echo "Firewalld detected. Configuring rules..."
    sudo firewall-cmd --permanent --add-service=http
    sudo firewall-cmd --permanent --add-service=https
    sudo firewall-cmd --reload
else
    echo "No firewall detected or manual configuration needed."
fi

# Final status check
echo "=== Configuration Complete ==="
echo "Checking Nginx status..."
sudo systemctl status nginx --no-pager -l

echo "Checking SSL certificate..."
sudo certbot certificates

echo "=== Setup Summary ==="
echo "✓ Nginx installed and configured"
echo "✓ SSL certificate obtained from Let's Encrypt"
echo "✓ Automatic renewal configured"
echo "✓ Firewall rules configured (if applicable)"
echo ""
echo "Your application should now be accessible at:"
echo "  https://reports.kagome.com.au"
echo ""
echo "HTTP traffic will automatically redirect to HTTPS"
echo ""
echo "To check logs:"
echo "  sudo tail -f /var/log/nginx/reports.kagome.com.au.access.log"
echo "  sudo tail -f /var/log/nginx/reports.kagome.com.au.error.log"