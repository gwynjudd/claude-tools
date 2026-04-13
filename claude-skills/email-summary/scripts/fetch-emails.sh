#!/bin/sh
# Fetch emails from Gmail for a given period.
# Usage: fetch-emails.sh --period <1d|7d|...> [--max-body-chars N]
exec node "$(dirname "$0")/../dist/fetch-emails.js" "$@"
