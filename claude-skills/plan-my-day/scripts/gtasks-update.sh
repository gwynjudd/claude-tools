#!/usr/bin/env bash
# Update a Google Task via pmd gtasks-update
# Usage: gtasks-update.sh --id <google-task-id> [--title "..."] [--due YYYY-MM-DD] [--status needsAction|completed] [--task-list <id>]
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/../tools/dist/cli.js" gtasks-update "$@"
