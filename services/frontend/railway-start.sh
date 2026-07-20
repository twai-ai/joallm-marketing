#!/bin/sh
set -e
# Railway custom start command target for the frontend service.
# Delegates to the real entrypoint (runtime env substitution + serve).
exec ./entrypoint.sh
