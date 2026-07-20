#!/bin/sh

# Replace API URL placeholders with runtime environment variables.
# Vite bakes env vars into the JS bundle at build time, so we use
# placeholders during the build and substitute real values at startup.

if [ -n "$VITE_API_URL" ]; then
  find /app/dist/assets -name "*.js" \
    -exec sed -i "s|__API_URL_PLACEHOLDER__|${VITE_API_URL}|g" {} \;
fi

if [ -n "$VITE_API_BASE_URL" ]; then
  find /app/dist/assets -name "*.js" \
    -exec sed -i "s|__API_BASE_URL_PLACEHOLDER__|${VITE_API_BASE_URL}|g" {} \;
fi

exec serve dist -s -l "${PORT:-5174}" --no-request-logging --no-clipboard
