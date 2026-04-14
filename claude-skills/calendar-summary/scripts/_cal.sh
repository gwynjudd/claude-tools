#!/usr/bin/env bash
# Internal helper — used by all cal scripts to locate and invoke the CLI.
# Source this file, then call: cal_run <subcommands...> "$@"
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CAL_CLI="$SCRIPT_DIR/../dist/cli.js"
cal_run() {
  NODE_NO_WARNINGS=1 exec node "$CAL_CLI" "$@"
}
