#!/usr/bin/env bash
# Full OAuth reauth for Google Tasks — opens browser, captures redirect,
# writes fresh tokens to the unified google-oauth token store.
# Use this for new setups or if the tasks token has been revoked.
set -euo pipefail

node --input-type=module <<'EOF'
import { reauth } from '/home/gwynj/dev/tools/google-oauth/dist/index.js';
await reauth('tasks');
EOF
