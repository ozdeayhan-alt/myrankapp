#!/usr/bin/env bash
# Operasyonel adımlar — Performans Paketi v1 sonrası
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> PM2 API"
pm2 restart myrankapp
pm2 save

echo "==> Firestore indexes"
GOOGLE_APPLICATION_CREDENTIALS="${ROOT}/service-account.json" \
  firebase deploy --only firestore:indexes --non-interactive

echo "==> Nginx HTTP proxy (port 80 -> 3000)"
cp deploy/nginx-api-http.conf /etc/nginx/sites-available/myrank-api
ln -sf /etc/nginx/sites-available/myrank-api /etc/nginx/sites-enabled/myrank-api
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo ""
echo "Tamamlandı. HTTPS için domain gerekli:"
echo "  ./deploy/setup-https.sh api.YOURDOMAIN.com admin@YOURDOMAIN.com"
echo "  ardından myrank-mobile/.env:"
echo "  EXPO_PUBLIC_API_URL=https://api.YOURDOMAIN.com"
