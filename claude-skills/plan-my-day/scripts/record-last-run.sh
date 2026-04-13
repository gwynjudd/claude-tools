#!/usr/bin/env bash
# Records the timestamp of the last plan-my-day run.
# Usage: ./record-last-run.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
date -Iseconds > "$SCRIPT_DIR/../config/.last-run"
