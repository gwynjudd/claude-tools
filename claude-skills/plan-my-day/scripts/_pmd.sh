#!/usr/bin/env bash
# Internal helper — used by all pmd scripts to locate and invoke the CLI.
# Sources this file, then calls: pmd_run <subcommands...> "$@"
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PMD_CLI="$SCRIPT_DIR/../tools/dist/cli.js"
pmd_run() {
  # Suppress Node experimental warnings (node:sqlite had these; kept for future-proofing)
  NODE_NO_WARNINGS=1 exec node "$PMD_CLI" "$@"
}
