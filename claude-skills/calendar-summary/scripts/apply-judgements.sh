#!/usr/bin/env bash
# Reads a compact judgements JSON array from stdin:
#   [{"id": "...", "prep_level": "HIGH"|"MEDIUM"|"LOW", "notes": "..."}, ...]
# Patches the fetch output at --fetch <file>, updates the cache,
# and prints the formatted calendar section.
#
# Usage:
#   echo '[{"id":"...","prep_level":"LOW","notes":"..."}]' | apply-judgements.sh --fetch cal.json [--format pmd]
#   apply-judgements.sh --fetch cal.json --format pmd < judgements.json
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_cal.sh"
cal_run judgements apply "$@"
