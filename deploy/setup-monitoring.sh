#!/usr/bin/env bash
# Health monitor cron — every 5 minutes
# Usage: ./deploy/setup-monitoring.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CRON_MARKER="myrankapp-health-monitor"
SCHEDULE="*/5 * * * *"

NODE_BIN="$(command -v node || true)"
if [[ -z "$NODE_BIN" || ! -x "$NODE_BIN" ]]; then
  echo "Hata: node bulunamadı." >&2
  exit 1
fi

LOG_DIR="$ROOT/logs"
mkdir -p "$LOG_DIR"

CRON_LINE="${SCHEDULE} cd ${ROOT} && ${NODE_BIN} scripts/health-monitor.js >> ${LOG_DIR}/health-monitor-cron.log 2>&1 # ${CRON_MARKER}"

EXISTING="$(crontab -l 2>/dev/null || true)"
FILTERED="$(echo "$EXISTING" | grep -v "${CRON_MARKER}" | grep -v '^[[:space:]]*$' || true)"

{
  echo "$FILTERED"
  echo "$CRON_LINE"
} | crontab -

echo "Health monitor cron kuruldu (her 5 dk)."
echo "Manuel test: cd ${ROOT} && node scripts/health-monitor.js"
