#!/usr/bin/env bash
# Copy public APK symlinks into nginx-readable download dir.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PUBLIC_DIR="$ROOT/public"
DOWNLOAD_DIR="${MYRANK_DOWNLOAD_DIR:-/var/www/myrank-download}"

mkdir -p "$DOWNLOAD_DIR"
shopt -s nullglob
apk_files=("$PUBLIC_DIR"/*.apk)
shopt -u nullglob

if ((${#apk_files[@]} == 0)); then
  echo "[sync-download-apks] No APK files in $PUBLIC_DIR"
  exit 0
fi

for src in "${apk_files[@]}"; do
  name="$(basename "$src")"
  dest="$DOWNLOAD_DIR/$name"
  if [[ ! -e "$src" ]]; then
    echo "[sync-download-apks] skip missing: $name"
    continue
  fi
  cp -fL "$src" "$dest"
  chmod 644 "$dest"
  chown root:www-data "$dest" 2>/dev/null || true
  echo "[sync-download-apks] $name -> $dest ($(stat -c '%s' "$dest") bytes)"
done

chmod 755 "$DOWNLOAD_DIR"
chown root:www-data "$DOWNLOAD_DIR" 2>/dev/null || true
