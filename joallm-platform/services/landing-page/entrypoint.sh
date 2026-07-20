#!/bin/sh

# Replace API URL placeholder with runtime environment variable.
# Vite bakes env vars into the JS bundle at build time, so we use
# a placeholder during the build and substitute the real value at startup.

if [ -n "$VITE_API_URL" ]; then
  find /app/dist/assets -name "*.js" \
    -exec sed -i "s|__API_URL_PLACEHOLDER__|${VITE_API_URL}|g" {} \;
fi

exec serve dist -s -l "${PORT:-3000}" --no-request-logging --no-clipboard
