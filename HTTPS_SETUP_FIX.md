# HTTPS Setup Fix - Step by Step Commands

The error occurred because Nginx tried to use SSL certificates that don't exist yet. Here's the corrected approach:

## Step 1: Fix the Current Issue

```bash
# SSH back into your server
ssh scada.sa@192.168.235.16

# Remove the broken configuration
sudo rm -f /etc/nginx/sites-enabled/reports.kagome.com.au

# Stop nginx if it's running
sudo systemctl stop nginx
```

## Step 2: Create HTTP-Only Configuration First

```bash
# Create the temporary HTTP-only configuration
sudo nano /etc/nginx/sites-available/reports.kagome.com.au
```

Copy and paste this HTTP-only configuration:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name reports.kagome.com.au;

    # Let's Encrypt challenge location
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

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
        proxy_pass http://127.0.0.1:30001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_redirect off;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://127.0.0.1:30001/health;
        access_log off;
    }

    # Logging
    access_log /var/log/nginx/reports.kagome.com.au.access.log;
    error_log /var/log/nginx/reports.kagome.com.au.error.log;
}
```

## Step 3: Enable and Test HTTP Configuration

```bash
# Enable the site
sudo ln -sf /etc/nginx/sites-available/reports.kagome.com.au /etc/nginx/sites-enabled/

# Test the configuration
sudo nginx -t

# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

## Step 4: Test HTTP Access

```bash
# Test local connection to your app
curl -I http://127.0.0.1:30001

# Test through Nginx
curl -I http://127.0.0.1:80 -H "Host: reports.kagome.com.au"
```

## Step 5: Get SSL Certificate

**IMPORTANT**: Make sure DNS is pointing to your server first!

```bash
# Check DNS resolution
nslookup reports.kagome.com.au

# Get SSL certificate - Certbot will automatically modify the Nginx config
sudo certbot --nginx -d reports.kagome.com.au --non-interactive --agree-tos --email admin@kagome.com.au
```

## Step 6: Verify HTTPS Setup

```bash
# Check certificate
sudo certbot certificates

# Test Nginx configuration after Certbot modifications
sudo nginx -t

# Restart Nginx to ensure everything is working
sudo systemctl restart nginx

# Check status
sudo systemctl status nginx
```

## Step 7: Test Final Setup

```bash
# Test HTTPS
curl -I https://reports.kagome.com.au

# Test HTTP redirect
curl -I http://reports.kagome.com.au
```

## If You Get DNS Issues

If DNS isn't working yet, you can test locally by adding to your hosts file:

```bash
# On the server, test with:
curl -I http://127.0.0.1:80 -H "Host: reports.kagome.com.au"

# On your local machine, add this to /etc/hosts (Mac/Linux) or C:\Windows\System32\drivers\etc\hosts (Windows):
192.168.235.16 reports.kagome.com.au
```

## Troubleshooting Commands

```bash
# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/reports.kagome.com.au.error.log

# Check if Kubernetes service is running
kubectl get pods -n historian-reports
kubectl get svc -n historian-reports

# Test direct connection to Kubernetes service
curl -I http://127.0.0.1:30001
```

The key difference is that we start with HTTP-only, then let Certbot automatically add the HTTPS configuration and certificates.