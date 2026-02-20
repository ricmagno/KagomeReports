# HTTPS Setup with Self-Signed Certificate (Internal Network)

Since `192.168.235.16` is a private IP address and `reports.kagome.com.au` isn't publicly accessible, Let's Encrypt cannot verify the domain. For internal use, we'll create a self-signed SSL certificate.

## Step 1: Create Self-Signed SSL Certificate

Run these commands on your SSH session:

```bash
# Create directory for SSL certificates
sudo mkdir -p /etc/ssl/private
sudo mkdir -p /etc/ssl/certs

# Generate self-signed certificate (valid for 365 days)
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/reports.kagome.com.au.key \
  -out /etc/ssl/certs/reports.kagome.com.au.crt \
  -subj "/C=AU/ST=Victoria/L=Melbourne/O=Kagome/OU=IT/CN=reports.kagome.com.au"

# Set proper permissions
sudo chmod 600 /etc/ssl/private/reports.kagome.com.au.key
sudo chmod 644 /etc/ssl/certs/reports.kagome.com.au.crt
```

## Step 2: Update Nginx Configuration with SSL

```bash
# Backup current config
sudo cp /etc/nginx/sites-available/reports.kagome.com.au /etc/nginx/sites-available/reports.kagome.com.au.backup

# Create new config with SSL
sudo tee /etc/nginx/sites-available/reports.kagome.com.au > /dev/null << 'EOF'
# HTTP server block - redirects to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name reports.kagome.com.au;

    # Redirect all HTTP traffic to HTTPS
    return 301 https://$server_name$request_uri;
}

# HTTPS server block
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name reports.kagome.com.au;

    # SSL certificate paths
    ssl_certificate /etc/ssl/certs/reports.kagome.com.au.crt;
    ssl_certificate_key /etc/ssl/private/reports.kagome.com.au.key;

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

    # Client max body size
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

    # Main location block
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

    # Static assets caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://127.0.0.1:30001;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Logging
    access_log /var/log/nginx/reports.kagome.com.au.access.log;
    error_log /var/log/nginx/reports.kagome.com.au.error.log;
}
EOF
```

## Step 3: Test and Restart Nginx

```bash
# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Check status
sudo systemctl status nginx
```

## Step 4: Configure Firewall (if needed)

```bash
# Allow HTTPS traffic
sudo ufw allow 443/tcp
sudo ufw allow 80/tcp
sudo ufw status
```

## Step 5: Test HTTPS Access

```bash
# Test from the server
curl -k -I https://127.0.0.1

# Test with domain name
curl -k -I https://reports.kagome.com.au
```

## Step 6: Configure DNS (Internal Network)

You need to configure your internal DNS or hosts file to point `reports.kagome.com.au` to `192.168.235.16`.

### Option A: Internal DNS Server
Add an A record in your internal DNS:
```
reports.kagome.com.au.  IN  A  192.168.235.16
```

### Option B: Hosts File (Each Client Machine)

**On Windows clients:**
Edit `C:\Windows\System32\drivers\etc\hosts` (as Administrator):
```
192.168.235.16  reports.kagome.com.au
```

**On Mac/Linux clients:**
Edit `/etc/hosts` (with sudo):
```
192.168.235.16  reports.kagome.com.au
```

## Step 7: Accept Self-Signed Certificate in Browser

When you first visit `https://reports.kagome.com.au`, your browser will show a security warning because the certificate is self-signed. This is expected for internal certificates.

**To proceed:**
1. Click "Advanced" or "Show Details"
2. Click "Proceed to reports.kagome.com.au (unsafe)" or "Accept the Risk and Continue"
3. The application will load normally

**For production use, consider:**
- Setting up an internal Certificate Authority (CA)
- Distributing the CA certificate to all client machines
- This eliminates browser warnings for all users

## Verification Commands

```bash
# Check certificate details
openssl x509 -in /etc/ssl/certs/reports.kagome.com.au.crt -text -noout

# Check if Nginx is listening on 443
sudo netstat -tlnp | grep :443

# View Nginx logs
sudo tail -f /var/log/nginx/reports.kagome.com.au.access.log
sudo tail -f /var/log/nginx/reports.kagome.com.au.error.log
```

## Maintenance

### Renew Certificate (Before Expiration)
```bash
# Generate new certificate (valid for another 365 days)
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/reports.kagome.com.au.key \
  -out /etc/ssl/certs/reports.kagome.com.au.crt \
  -subj "/C=AU/ST=Victoria/L=Melbourne/O=Kagome/OU=IT/CN=reports.kagome.com.au"

# Restart Nginx
sudo systemctl restart nginx
```

### Check Certificate Expiration
```bash
openssl x509 -in /etc/ssl/certs/reports.kagome.com.au.crt -noout -dates
```

## Summary

✅ Self-signed SSL certificate created
✅ Nginx configured with HTTPS
✅ HTTP automatically redirects to HTTPS
✅ Security headers configured
✅ Application accessible at https://reports.kagome.com.au

**Note:** Self-signed certificates are perfect for internal networks. For public-facing sites, you would need a proper DNS setup and Let's Encrypt or commercial SSL certificate.