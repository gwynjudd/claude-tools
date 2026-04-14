#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$SCRIPT_DIR/../data"
exec node "$SCRIPT_DIR/../tools/dist/cli.js" migrate --from "$DATA_DIR" "$@"
