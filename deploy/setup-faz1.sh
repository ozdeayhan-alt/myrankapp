#!/usr/bin/env bash
# Faz 0 kalan + Faz 1: Redis, worker, userFeeds backfill, PM2 reload
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Redis"
if ! command -v redis-server >/dev/null 2>&1; then
  apt-get update
  apt-get install -y redis-server
fi
systemctl enable redis-server
systemctl start redis-server
redis-cli ping

echo "==> npm install"
npm install

echo "==> tests"
npm test

echo "==> PM2 apps (api + worker)"
pm2 startOrReload "$ROOT/ecosystem.config.cjs" --only myrankapp,myrankapp-worker
pm2 save

echo "==> userFeeds backfill (skip-existing)"
node scripts/backfill-user-feeds.js --skip-existing --sleep-ms=25 || true

echo ""
echo "Faz 1 deploy tamam."
echo "  /status -> redisStatus, mediaProxy, feedCache.backend"
echo "  pm2 logs myrankapp-worker"
