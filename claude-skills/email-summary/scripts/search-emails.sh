#!/usr/bin/env bash
# Search Gmail and return full email content as readable text.
# Usage: search-emails.sh --query <gmail query> [--max N] [--max-body-chars N]
exec node "$(dirname "$0")/../dist/search-emails.js" "$@"
