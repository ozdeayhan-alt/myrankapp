#!/usr/bin/env bash
set -euo pipefail

# Usage: ./deploy/setup-https.sh api.yourdomain.com admin@yourdomain.com
# Requires: nginx, certbot (python3-certbot-nginx)

DOMAIN="${1:-}"
EMAIL="${2:-}"

if [[ -z "$DOMAIN" || -z "$EMAIL" ]]; then
  echo "Usage: $0 <api-domain> <letsencrypt-email>"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONF="/etc/nginx/sites-available/myrank-api"

sudo sed "s/api.example.com/${DOMAIN}/g" "${SCRIPT_DIR}/nginx-api.conf" | sudo tee "$CONF" >/dev/null
sudo ln -sf "$CONF" /etc/nginx/sites-enabled/myrank-api
sudo nginx -t
sudo systemctl reload nginx

sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect

echo "HTTPS ready: https://${DOMAIN}"
echo "Set EXPO_PUBLIC_API_URL=https://${DOMAIN} in myrank-mobile/.env"
