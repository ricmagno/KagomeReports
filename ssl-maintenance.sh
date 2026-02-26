#!/bin/bash

# SSL Maintenance Script for reports.kagome.com.au
# Useful commands for managing the SSL setup

case "$1" in
    "status")
        echo "=== Nginx Status ==="
        sudo systemctl status nginx --no-pager
        echo ""
        echo "=== SSL Certificate Status ==="
        sudo certbot certificates
        echo ""
        echo "=== Certificate Renewal Timer ==="
        sudo systemctl status certbot.timer --no-pager
        ;;
    
    "renew")
        echo "=== Renewing SSL Certificate ==="
        sudo certbot renew
        sudo systemctl reload nginx
        ;;
    
    "test-renewal")
        echo "=== Testing SSL Certificate Renewal ==="
        sudo certbot renew --dry-run
        ;;
    
    "logs")
        echo "=== Recent Nginx Access Logs ==="
        sudo tail -20 /var/log/nginx/reports.kagome.com.au.access.log
        echo ""
        echo "=== Recent Nginx Error Logs ==="
        sudo tail -20 /var/log/nginx/reports.kagome.com.au.error.log
        ;;
    
    "reload")
        echo "=== Reloading Nginx Configuration ==="
        sudo nginx -t && sudo systemctl reload nginx
        ;;
    
    "restart")
        echo "=== Restarting Nginx ==="
        sudo systemctl restart nginx
        ;;
    
    "test-config")
        echo "=== Testing Nginx Configuration ==="
        sudo nginx -t
        ;;
    
    "ssl-info")
        echo "=== SSL Certificate Information ==="
        echo | openssl s_client -servername reports.kagome.com.au -connect reports.kagome.com.au:443 2>/dev/null | openssl x509 -noout -dates
        ;;
    
    *)
        echo "SSL Maintenance Script for reports.kagome.com.au"
        echo ""
        echo "Usage: $0 {status|renew|test-renewal|logs|reload|restart|test-config|ssl-info}"
        echo ""
        echo "Commands:"
        echo "  status       - Show Nginx and SSL certificate status"
        echo "  renew        - Renew SSL certificate"
        echo "  test-renewal - Test SSL certificate renewal (dry run)"
        echo "  logs         - Show recent Nginx logs"
        echo "  reload       - Reload Nginx configuration"
        echo "  restart      - Restart Nginx service"
        echo "  test-config  - Test Nginx configuration syntax"
        echo "  ssl-info     - Show SSL certificate expiration dates"
        ;;
esac