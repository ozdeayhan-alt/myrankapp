#!/usr/bin/env bash
# Gece 00:00 (Europe/Istanbul) ranking rebuild cron kurulumu.
# Kullanım: bash scripts/setup-cron.sh
#          PROJECT_DIR=/opt/myrankapp bash scripts/setup-cron.sh

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/root/myrankapp}"
CRON_MARKER="myrankapp-rebuild-rankings"
PRUNE_MARKER="myrankapp-prune-push-tokens"
CRON_TIMEZONE="Europe/Istanbul"
SERVER_TIMEZONE="Etc/UTC"
SCHEDULE="0 0 * * *"
PRUNE_SCHEDULE="0 3 * * 0"

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

# 00:00 Europe/Istanbul (sunucu UTC olsa bile CRON_TZ ile doğru saat)
CRON_LINE="${SCHEDULE} cd ${PROJECT_DIR} && ${NODE_BIN} scripts/rebuild-rankings.js >> ${LOG_FILE} 2>&1 # ${CRON_MARKER}"
PRUNE_LOG="$LOG_DIR/prune-push-tokens.log"
PRUNE_LINE="${PRUNE_SCHEDULE} cd ${PROJECT_DIR} && ${NODE_BIN} scripts/prune-push-tokens.js --all >> ${PRUNE_LOG} 2>&1 # ${PRUNE_MARKER}"

EXISTING="$(crontab -l 2>/dev/null || true)"
FILTERED="$(echo "$EXISTING" | grep -v "${CRON_MARKER}" | grep -v "${PRUNE_MARKER}" | grep -v '^CRON_TZ=' | grep -v '^[[:space:]]*$' || true)"

{
  echo "$FILTERED"
  echo "CRON_TZ=${CRON_TIMEZONE}"
  echo "$CRON_LINE"
  echo "CRON_TZ=${SERVER_TIMEZONE}"
  echo "$PRUNE_LINE"
} | crontab -

echo ""
echo "Cron kuruldu."
echo "  Proje:  $PROJECT_DIR"
echo "  Node:   $NODE_BIN"
echo "  Log:    $LOG_FILE"
echo "  Saat:   Her gün 00:00 (Europe/Istanbul)"
echo ""
echo "Mevcut crontab:"
crontab -l | grep -E "${CRON_MARKER}|${PRUNE_MARKER}|^CRON_TZ=" || true
echo ""
echo "Manuel test:"
echo "  cd ${PROJECT_DIR} && npm run rebuild-rankings"
echo "  cd ${PROJECT_DIR} && npm run prune-push-tokens -- --all"
