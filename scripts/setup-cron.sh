#!/usr/bin/env bash
# Gece 00:00 (Europe/Istanbul) ranking rebuild cron kurulumu.
# Kullanım: bash scripts/setup-cron.sh
#          PROJECT_DIR=/opt/myrankapp bash scripts/setup-cron.sh

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/root/myrankapp}"
CRON_MARKER="myrankapp-rebuild-rankings"
SCHEDULE="0 0 * * *"

NODE_BIN="$(command -v node || true)"
if [[ -z "$NODE_BIN" || ! -x "$NODE_BIN" ]]; then
  echo "Hata: node bulunamadı. PATH içinde node kurulu olmalı." >&2
  exit 1
fi

if [[ ! -f "$PROJECT_DIR/package.json" ]]; then
  echo "Hata: $PROJECT_DIR içinde package.json yok." >&2
  exit 1
fi

if [[ ! -f "$PROJECT_DIR/scripts/rebuild-rankings.js" ]]; then
  echo "Hata: $PROJECT_DIR/scripts/rebuild-rankings.js yok." >&2
  exit 1
fi

# Log: önce proje logs/, isteğe bağlı /var/log (root + yazılabilirse)
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/rebuild-rankings.log"
mkdir -p "$LOG_DIR"
touch "$LOG_FILE"

if [[ -w /var/log ]] 2>/dev/null; then
  ALT_LOG="/var/log/myrank-rankings.log"
  touch "$ALT_LOG" 2>/dev/null && LOG_FILE="$ALT_LOG" || true
fi

if [[ ! -f "$PROJECT_DIR/.env" ]]; then
  echo "Uyarı: $PROJECT_DIR/.env yok — Firebase bağlantısı için gerekli olabilir."
fi

if [[ ! -f "$PROJECT_DIR/service-account.json" ]]; then
  echo "Uyarı: $PROJECT_DIR/service-account.json yok — job başarısız olabilir."
fi

# crontab satırı (TZ satır içi; her gece 00:00 Istanbul)
CRON_LINE="${SCHEDULE} cd ${PROJECT_DIR} && TZ=Europe/Istanbul ${NODE_BIN} scripts/rebuild-rankings.js >> ${LOG_FILE} 2>&1 # ${CRON_MARKER}"

EXISTING="$(crontab -l 2>/dev/null || true)"
FILTERED="$(echo "$EXISTING" | grep -v "${CRON_MARKER}" | grep -v '^[[:space:]]*$' || true)"

{
  echo "$FILTERED"
  echo "$CRON_LINE"
} | crontab -

echo ""
echo "Cron kuruldu."
echo "  Proje:  $PROJECT_DIR"
echo "  Node:   $NODE_BIN"
echo "  Log:    $LOG_FILE"
echo "  Saat:   Her gün 00:00 (Europe/Istanbul)"
echo ""
echo "Mevcut crontab:"
crontab -l | grep "${CRON_MARKER}" || true
echo ""
echo "Manuel test:"
echo "  cd ${PROJECT_DIR} && npm run rebuild-rankings"
