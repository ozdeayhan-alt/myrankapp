#!/usr/bin/env bash
# Apply Firebase media CDN proxy on nginx (preserves %2F encoding).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

sudo mkdir -p /var/cache/nginx/fbmedia
sudo cp "$SCRIPT_DIR/nginx-fbmedia-map.conf" /etc/nginx/conf.d/fbmedia-map.conf
sudo cp "$SCRIPT_DIR/nginx-media-cache.conf" /etc/nginx/conf.d/fbmedia-cache.conf 2>/dev/null || true
if [[ ! -f /etc/nginx/conf.d/fbmedia-cache.conf ]]; then
  echo 'proxy_cache_path /var/cache/nginx/fbmedia levels=1:2 keys_zone=fbmedia:64m max_size=4g inactive=14d use_temp_path=off;' | sudo tee /etc/nginx/conf.d/fbmedia-cache.conf >/dev/null
fi
sudo cp "$SCRIPT_DIR/nginx-myrank-production.conf" /etc/nginx/sites-available/myrank-api
sudo ln -sf /etc/nginx/sites-available/myrank-api /etc/nginx/sites-enabled/myrank-api
sudo nginx -t
sudo systemctl reload nginx

echo "Media proxy active: https://myrank.com.tr/fb-media/…"
