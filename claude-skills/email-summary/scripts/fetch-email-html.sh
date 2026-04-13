#!/bin/sh
# Fetches the HTML body of a Gmail message via the Gmail API.
# Usage: fetch-email-html.sh <messageId> [--max-chars N]
exec node "$(dirname "$0")/../dist/fetch-email-html.js" "$@"
