#!/bin/sh
# Migrate Gmail tokens from ~/.gmail-mcp/ to the unified token store.
# Usage: gmail-migrate.sh
exec node "$(dirname "$0")/../dist/cli.js" auth migrate "$@"
