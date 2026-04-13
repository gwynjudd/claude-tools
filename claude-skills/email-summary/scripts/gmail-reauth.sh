#!/bin/sh
# Re-authorize Gmail OAuth credentials.
# Usage: gmail-reauth.sh
exec node "$(dirname "$0")/../dist/gmail-reauth.js" "$@"
