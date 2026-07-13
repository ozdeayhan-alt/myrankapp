#!/usr/bin/env bash
# Copy public APK symlinks into nginx-readable download dir.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PUBLIC_DIR="$ROOT/public"
DOWNLOAD_DIR="${MYRANK_DOWNLOAD_DIR:-/var/www/myrank-download}"

mkdir -p "$DOWNLOAD_DIR"
shopt -s nullglob
apk_files=("$PUBLIC_DIR"/*.apk)
aab_files=("$PUBLIC_DIR"/*.aab)
shopt -u nullglob

if ((${#apk_files[@]} == 0 && ${#aab_files[@]} == 0)); then
  echo "[sync-download-apks] No APK/AAB files in $PUBLIC_DIR"
  exit 0
fi

sync_file() {
  local src="$1"
  local name dest
  name="$(basename "$src")"
  dest="$DOWNLOAD_DIR/$name"
  if [[ ! -e "$src" ]]; then
    echo "[sync-download-apks] skip missing: $name"
    return
  fi
  cp -fL "$src" "$dest"
  chmod 644 "$dest"
  chown root:www-data "$dest" 2>/dev/null || true
  echo "[sync-download-apks] $name -> $dest ($(stat -c '%s' "$dest") bytes)"
}

for src in "${apk_files[@]}"; do
  sync_file "$src"
done

for src in "${aab_files[@]}"; do
  sync_file "$src"
done

# Nginx /download/myrank.apk — dosya adı myrank-test.apk; public URL myrank.apk
test_apk="$DOWNLOAD_DIR/myrank-test.apk"
main_apk="$DOWNLOAD_DIR/myrank.apk"
if [[ -f "$test_apk" ]]; then
  cp -f "$test_apk" "$main_apk"
  chmod 644 "$main_apk"
  chown root:www-data "$main_apk" 2>/dev/null || true
  echo "[sync-download-apks] myrank.apk -> $main_apk ($(stat -c '%s' "$main_apk") bytes)"
fi

chmod 755 "$DOWNLOAD_DIR"
chown root:www-data "$DOWNLOAD_DIR" 2>/dev/null || true
