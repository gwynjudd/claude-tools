#!/bin/sh
exec node "$(dirname "$0")/../dist/pre-classify.js" "$@"
