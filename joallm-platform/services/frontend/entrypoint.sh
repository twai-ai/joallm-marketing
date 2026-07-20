#!/bin/sh
set -e

# Replace API URL placeholders with runtime environment variables.
# Vite bakes env vars into the JS bundle at build time, so we use
# placeholders during the build and substitute real values at startup.
#
# IMPORTANT: only the import.meta.env values should contain the placeholder
# tokens. Do not put the exact token string in other source checks — sed
# replaces every occurrence in dist/assets/*.js.

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
      # Private network host — unusable in the browser
      printf ''
      ;;
    *)
      printf 'https://%s' "$raw"
      ;;
  esac
}

replace_token() {
  token="$1"
  value="$2"
  if [ -z "$value" ]; then
    echo "entrypoint: skip empty replacement for ${token}"
    return 0
  fi
  # Escape sed replacement specials: \ & |
  escaped=$(printf '%s' "$value" | sed -e 's/[\\&|]/\\&/g')
  find /app/dist/assets -name "*.js" \
    -exec sed -i "s|${token}|${escaped}|g" {} \;
  echo "entrypoint: replaced ${token} -> ${value}"
}

if [ -n "$VITE_API_URL" ]; then
  API_URL="$(normalize_url "$VITE_API_URL")"
  if [ -z "$API_URL" ]; then
    echo "entrypoint: ERROR VITE_API_URL is missing or not browser-reachable (no railway.internal)"
    exit 1
  fi
  replace_token "__API_URL_PLACEHOLDER__" "$API_URL"
else
  echo "entrypoint: ERROR VITE_API_URL is not set"
  exit 1
fi

if [ -n "$VITE_API_BASE_URL" ]; then
  API_BASE_URL="$(normalize_url "$VITE_API_BASE_URL")"
  replace_token "__API_BASE_URL_PLACEHOLDER__" "$API_BASE_URL"
else
  replace_token "__API_BASE_URL_PLACEHOLDER__" "$API_URL"
fi

exec serve dist -s -l "${PORT:-5174}" --no-request-logging --no-clipboard
