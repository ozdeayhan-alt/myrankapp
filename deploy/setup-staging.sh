#!/usr/bin/env bash
# Staging environment: PM2 instance on :3001 + nginx + HTTPS
# Usage: ./deploy/setup-staging.sh ozdeayhan@gmail.com
set -euo pipefail

EMAIL="${1:-}"
if [[ -z "$EMAIL" ]]; then
  echo "Usage: $0 <letsencrypt-email>"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
STAGING_DOMAIN="staging.myrank.com.tr"

echo "==> DNS check for ${STAGING_DOMAIN}"
RESOLVED="$(dig +short "${STAGING_DOMAIN}" A 2>/dev/null | head -1 || true)"
if [[ -z "$RESOLVED" ]]; then
  echo ""
  echo "UYARI: ${STAGING_DOMAIN} DNS kaydı bulunamadı."
  echo "Domain panelinde ekleyin:"
  echo "  A    staging    →  $(curl -4 -s ifconfig.me 2>/dev/null || echo 'SERVER_IP')"
  echo ""
  echo "DNS yayıldıktan sonra bu scripti tekrar çalıştırın."
  echo "PM2 staging instance yine de başlatılıyor..."
fi

echo "==> PM2 staging instance (port 3001)"
cd "$ROOT"
pm2 start ecosystem.config.cjs --only myrankapp-staging || pm2 restart myrankapp-staging
pm2 save

echo "==> Nginx staging site"
STAGING_CONF="$SCRIPT_DIR/nginx-staging-http.conf"
if [[ -f "/etc/letsencrypt/live/${STAGING_DOMAIN}/fullchain.pem" ]]; then
  STAGING_CONF="$SCRIPT_DIR/nginx-staging.conf"
elif [[ -n "$RESOLVED" ]]; then
  sudo cp "$SCRIPT_DIR/nginx-staging-http.conf" /etc/nginx/sites-available/myrank-staging
  sudo ln -sf /etc/nginx/sites-available/myrank-staging /etc/nginx/sites-enabled/myrank-staging
  sudo nginx -t && sudo systemctl reload nginx
  echo "==> Let's Encrypt for ${STAGING_DOMAIN}"
  if sudo certbot --nginx -d "$STAGING_DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect; then
    STAGING_CONF="$SCRIPT_DIR/nginx-staging.conf"
  fi
fi

sudo cp "$STAGING_CONF" /etc/nginx/sites-available/myrank-staging

sudo nginx -t
sudo systemctl reload nginx

echo ""
echo "Staging hazır:"
echo "  API (local):  http://127.0.0.1:3001/status"
if [[ -n "$RESOLVED" ]]; then
  echo "  API (HTTPS):  https://${STAGING_DOMAIN}/status"
fi
echo "  Mobile env:   EXPO_PUBLIC_API_URL=https://${STAGING_DOMAIN}"
