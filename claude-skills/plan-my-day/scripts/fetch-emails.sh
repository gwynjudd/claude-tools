#!/usr/bin/env bash
# Fetch, pre-classify, and summarise emails for the plan-my-day briefing.
# Outputs a compact text digest ready for the agent to classify.
set -euo pipefail

SCRIPTS="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../../email-summary/scripts"
SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$SCRIPTS/fetch-emails.sh" --period 1d --max-body-chars 1000 | "$SCRIPTS/pre-classify.sh" | "$SELF/summarize-emails.sh"
