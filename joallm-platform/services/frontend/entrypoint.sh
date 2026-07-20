#!/bin/sh

# Replace API URL placeholders with runtime environment variables.
# Vite bakes env vars into the JS bundle at build time, so we use
# placeholders during the build and substitute real values at startup.

normalize_url() {
  raw="$1"
  # strip trailing slash
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
    *)
      printf 'https://%s' "$raw"
      ;;
  esac
}

if [ -n "$VITE_API_URL" ]; then
  API_URL="$(normalize_url "$VITE_API_URL")"
  find /app/dist/assets -name "*.js" \
    -exec sed -i "s|__API_URL_PLACEHOLDER__|${API_URL}|g" {} \;
fi

if [ -n "$VITE_API_BASE_URL" ]; then
  API_BASE_URL="$(normalize_url "$VITE_API_BASE_URL")"
  find /app/dist/assets -name "*.js" \
    -exec sed -i "s|__API_BASE_URL_PLACEHOLDER__|${API_BASE_URL}|g" {} \;
elif [ -n "$VITE_API_URL" ]; then
  API_URL="$(normalize_url "$VITE_API_URL")"
  find /app/dist/assets -name "*.js" \
    -exec sed -i "s|__API_BASE_URL_PLACEHOLDER__|${API_URL}|g" {} \;
fi

exec serve dist -s -l "${PORT:-5174}" --no-request-logging --no-clipboard
