#!/usr/bin/env bash
# One-time migration: copies the Google Tasks refresh token from the gtasks
# MCP server config in ~/.claude.json into the unified google-oauth token store.
# Run this once when switching from MCP-based to direct API auth.
set -euo pipefail

node --input-type=module <<'EOF'
import { migrateTasksTokens } from '/home/gwynj/dev/tools/google-oauth/dist/index.js';
await migrateTasksTokens();
EOF
