#!/bin/sh
set -e
# Railway custom start command target.
# Prefer Dockerfile CMD; this script exists so a dashboard Start Command of
# ./railway-start.sh keeps working.
exec node dist/index.js
