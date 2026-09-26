#!/bin/sh
set -eu

# Fail startup if migrations or volume permissions are invalid.
node /app/.output/server/migrate.mjs
exec "$@"
