# HTTPS Setup Guide for reports.kagome.com.au

This guide will help you set up HTTPS with automatic SSL certificates for your Kubernetes-deployed Historian Reports application.

## Prerequisites

- Domain `reports.kagome.com.au` should be pointing to `192.168.235.16`
- Kubernetes service running on port 30001
- SSH access to the server at `192.168.235.16`

## Step 1: Initial Setup (Run on SSH Server)

```bash
# Update system packages
sudo apt update

# Install Nginx
sudo apt install -y nginx

# Install Certbot and Nginx plugin
sudo apt install -y certbot python3-certbot-nginx

# Stop Nginx temporarily for initial setup
sudo systemctl stop nginx

# Remove default Nginx site
sudo rm -f /etc/nginx/sites-enabled/default
```

## Step 2: Create Nginx Configuration

Create the Nginx configuration file:

```bash
sudo nano /etc/nginx/sites-available/reports.kagome.com.au
```

Copy and paste this configuration:

```nginx
# HTTP server block - redirects to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name reports.kagome.com.au;

    # Let's Encrypt challenge location
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirect all other HTTP traffic to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server block - main configuration
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name reports.kagome.com.au;

    # SSL certificate paths (will be configured by Certbot)
    # ssl_certificate /etc/letsencrypt/live/reports.kagome.com.au/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/reports.kagome.com.au/privkey.pem;

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

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Client max body size for file uploads
    client_max_body_size 100M;

    # Proxy settings
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Port $server_port;

    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    # Buffer settings
    proxy_buffering on;
    proxy_buffer_size 4k;
    proxy_buffers 8 4k;

    # Main location block - proxy to Kubernetes service
    location / {
        # Proxy to the Kubernetes NodePort service
        proxy_pass http://127.0.0.1:30001;
        
        # WebSocket support (if needed for real-time features)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Handle redirects properly
        proxy_redirect off;
    }

    # Health check endpoint (optional)
    location /health {
        proxy_pass http://127.0.0.1:30001/health;
        access_log off;
    }

    # Static assets caching (if served by Nginx)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://127.0.0.1:30001;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Logging
    access_log /var/log/nginx/reports.kagome.com.au.access.log;
    error_log /var/log/nginx/reports.kagome.com.au.error.log;
}
```

## Step 3: Enable the Site and Test Configuration

```bash
# Enable the site
sudo ln -sf /etc/nginx/sites-available/reports.kagome.com.au /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

## Step 4: Configure Firewall (if needed)

```bash
# For UFW (Ubuntu Firewall)
if command -v ufw &> /dev/null; then
    sudo ufw allow 'Nginx Full'
    sudo ufw allow ssh
    sudo ufw --force enable
fi

# For Firewalld (CentOS/RHEL)
if command -v firewall-cmd &> /dev/null; then
    sudo firewall-cmd --permanent --add-service=http
    sudo firewall-cmd --permanent --add-service=https
    sudo firewall-cmd --reload
fi
```

## Step 5: Obtain SSL Certificate

**IMPORTANT**: Make sure your DNS is properly configured before running this step!

```bash
# Check DNS resolution first
nslookup reports.kagome.com.au

# Obtain SSL certificate (replace email with your actual email)
sudo certbot --nginx -d reports.kagome.com.au --non-interactive --agree-tos --email admin@kagome.com.au
```

## Step 6: Test and Verify

```bash
# Test certificate renewal
sudo certbot renew --dry-run

# Setup automatic renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# Check Nginx status
sudo systemctl status nginx

# Check SSL certificate
sudo certbot certificates
```

## Step 7: Verify HTTPS is Working

1. Open your browser and go to `https://reports.kagome.com.au`
2. Verify the SSL certificate is valid
3. Test that HTTP redirects to HTTPS by visiting `http://reports.kagome.com.au`

## Maintenance Commands

### Check Status
```bash
# Nginx status
sudo systemctl status nginx

# SSL certificate status
sudo certbot certificates

# Certificate renewal timer
sudo systemctl status certbot.timer
```

### View Logs
```bash
# Access logs
sudo tail -f /var/log/nginx/reports.kagome.com.au.access.log

# Error logs
sudo tail -f /var/log/nginx/reports.kagome.com.au.error.log

# Nginx error log
sudo tail -f /var/log/nginx/error.log
```

### Manual Certificate Renewal
```bash
# Renew certificates
sudo certbot renew

# Reload Nginx after renewal
sudo systemctl reload nginx
```

### Restart Services
```bash
# Restart Nginx
sudo systemctl restart nginx

# Test configuration before restart
sudo nginx -t && sudo systemctl restart nginx
```

## Troubleshooting

### Common Issues

1. **DNS not resolving**: Make sure `reports.kagome.com.au` points to `192.168.235.16`
2. **Port 80/443 blocked**: Check firewall settings
3. **Certificate generation fails**: Ensure DNS is working and ports are open
4. **502 Bad Gateway**: Check if Kubernetes service is running on port 30001

### Verify Kubernetes Service
```bash
# Check if the service is running
kubectl get pods -n historian-reports
kubectl get svc -n historian-reports

# Test local connection
curl -I http://127.0.0.1:30001
```

### Test SSL Certificate
```bash
# Check certificate expiration
echo | openssl s_client -servername reports.kagome.com.au -connect reports.kagome.com.au:443 2>/dev/null | openssl x509 -noout -dates
```

## Security Notes

- The configuration includes security headers for protection
- SSL certificates will auto-renew via systemd timer
- Only TLS 1.2 and 1.3 are enabled
- Strong cipher suites are configured
- HTTP traffic is automatically redirected to HTTPS

## Next Steps

After successful setup:
1. Monitor logs for any issues
2. Set up monitoring/alerting for certificate expiration
3. Consider setting up log rotation if not already configured
4. Test the application functionality through HTTPS