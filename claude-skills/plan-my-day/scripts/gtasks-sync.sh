#!/bin/bash
# Usage: echo '<google-tasks-json>' | gtasks-sync.sh
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/_pmd.sh"
pmd_run gtasks-sync "$@"
