#!/bin/sh
# General wrapper for the email management CLI.
# Usage: email.sh <command> [args...]
#   email.sh auth reauth
#   email.sh auth migrate
#   email.sh cache store-ai --id <id> --category <CAT>
exec node "$(dirname "$0")/../dist/cli.js" "$@"
