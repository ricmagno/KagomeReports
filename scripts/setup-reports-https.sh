#!/bin/bash

# setup-reports-https.sh
# Script to configure Nginx with SSL and redirection for reports.kagome.com.au
# target port 3001 on the host

set -e

DOMAIN="reports.kagome.com.au"
TARGET_PORT=3001
IP_ADDR="192.168.235.16"

echo "=== Historian Reports HTTPS Setup for $DOMAIN ==="

# 1. Install Nginx if not present
if ! command -v nginx &> /dev/null; then
    echo "Nginx not found. Installing..."
    sudo apt update
    sudo apt install -y nginx
fi

# 2. Create directory for SSL if it doesn't exist
sudo mkdir -p /etc/ssl/private
sudo mkdir -p /etc/ssl/certs

# 3. Ask for SSL Method
echo "Select SSL Method:"
echo "1) Self-Signed Certificate (Recommended for Internal Network)"
echo "2) Let's Encrypt (Requires public DNS and port 80 access)"
read -p "Enter choice [1-2]: " SSL_CHOICE

if [ "$SSL_CHOICE" == "1" ]; then
    echo "Generating self-signed certificate..."
    sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout /etc/ssl/private/$DOMAIN.key \
      -out /etc/ssl/certs/$DOMAIN.crt \
      -subj "/C=AU/ST=Victoria/L=Melbourne/O=Kagome/OU=IT/CN=$DOMAIN"
    
    sudo chmod 600 /etc/ssl/private/$DOMAIN.key
    sudo chmod 644 /etc/ssl/certs/$DOMAIN.crt
    
    # Update configuration with SSL paths
    SSL_CERT_PATH="/etc/ssl/certs/$DOMAIN.crt"
    SSL_KEY_PATH="/etc/ssl/private/$DOMAIN.key"
elif [ "$SSL_CHOICE" == "2" ]; then
    echo "Using Let's Encrypt. Make sure $DOMAIN resolves to this IP and port 80 is open."
    sudo apt install -y certbot python3-certbot-nginx
    # We will run certbot after nginx is configured
else
    echo "Invalid choice. Defaulting to Self-Signed."
    # ... same as choice 1 ...
fi

# 4. Create Nginx Configuration
echo "Creating Nginx configuration..."
cat <<EOF | sudo tee /etc/nginx/sites-available/$DOMAIN > /dev/null
# HTTP server block - redirects to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;

    # Let's Encrypt challenge location
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirect all other HTTP traffic to HTTPS
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

# HTTPS server block
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN;

    # SSL certificate paths
EOF

if [ "$SSL_CHOICE" == "1" ]; then
cat <<EOF | sudo tee -a /etc/nginx/sites-available/$DOMAIN > /dev/null
    ssl_certificate $SSL_CERT_PATH;
    ssl_certificate_key $SSL_KEY_PATH;
EOF
else
cat <<EOF | sudo tee -a /etc/nginx/sites-available/$DOMAIN > /dev/null
    # SSL paths will be managed by certbot
    # ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
EOF
fi

cat <<EOF | sudo tee -a /etc/nginx/sites-available/$DOMAIN > /dev/null

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Proxy settings
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header X-Forwarded-Host \$host;
    proxy_set_header X-Forwarded-Port \$server_port;

    location / {
        proxy_pass http://127.0.0.1:$TARGET_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_redirect off;
    }

    access_log /var/log/nginx/$DOMAIN.access.log;
    error_log /var/log/nginx/$DOMAIN.error.log;
}
EOF

# 5. Enable the site
sudo ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# 6. Test and Restart Nginx
echo "Testing configuration..."
sudo nginx -t

echo "Restarting Nginx..."
sudo systemctl restart nginx
sudo systemctl enable nginx

# 7. Configure Firewall
echo "Configuring firewall..."
if command -v ufw &> /dev/null; then
    sudo ufw allow 'Nginx Full'
    sudo ufw allow ssh
    sudo ufw --force enable
elif command -v firewall-cmd &> /dev/null; then
    sudo firewall-cmd --permanent --add-service=http
    sudo firewall-cmd --permanent --add-service=https
    sudo firewall-cmd --reload
fi

# 8. Run Certbot if requested
if [ "$SSL_CHOICE" == "2" ]; then
    echo "Running Certbot..."
    sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@kagome.com.au
fi

echo "=== Setup Complete ==="
echo "Application should be accessible at https://$DOMAIN"
echo "Note: If using self-signed certificate, you will need to accept the warning in your browser."
