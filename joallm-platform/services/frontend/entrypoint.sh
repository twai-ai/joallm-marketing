#!/bin/sh
set -e

# Write browser-readable runtime config. Do NOT sed-replace placeholders inside
# the Vite JS bundle — that rewrites detector strings and breaks production.

normalize_url() {
  raw="$1"
  raw=$(printf '%s' "$raw" | sed 's|/*$||')
  case "$raw" in
    "")
      printf ''
      ;;
    http://*|https://*)
      printf '%s' "$raw"
      ;;
    localhost*|127.*)
      printf 'http://%s' "$raw"
      ;;
    *.railway.internal|railway.internal)
      printf ''
      ;;
    *)
      printf 'https://%s' "$raw"
      ;;
  esac
}

json_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

if [ -z "$VITE_API_URL" ]; then
  echo "entrypoint: ERROR VITE_API_URL is not set"
  exit 1
fi

API_URL="$(normalize_url "$VITE_API_URL")"
if [ -z "$API_URL" ]; then
  echo "entrypoint: ERROR VITE_API_URL must be a public https URL (not *.railway.internal)"
  exit 1
fi

if [ -n "$VITE_API_BASE_URL" ]; then
  API_BASE_URL="$(normalize_url "$VITE_API_BASE_URL")"
else
  API_BASE_URL="$API_URL"
fi

APP_ENV="${VITE_APP_ENV:-production}"

cat > /app/dist/runtime-config.js <<EOF
window.__ATRISI_ENV__ = {
  VITE_API_URL: "$(json_escape "$API_URL")",
  VITE_API_BASE_URL: "$(json_escape "$API_BASE_URL")",
  VITE_APP_ENV: "$(json_escape "$APP_ENV")"
};
EOF

# Ensure index.html loads runtime-config.js before the app bundle
if [ -f /app/dist/index.html ] && ! grep -q 'runtime-config.js' /app/dist/index.html; then
  sed -i 's|<head>|<head>\n    <script src="/runtime-config.js"></script>|' /app/dist/index.html
fi

echo "entrypoint: runtime API URL = ${API_URL}"

exec serve dist -s -l "${PORT:-5174}" --no-request-logging --no-clipboard
