#!/bin/sh
# Download a Gmail attachment and save it to a target directory.
# Usage: save-attachment.sh \
#   --message-id <id> --attachment-id <id> \
#   --target-dir <absolute-path> --date <YYYY-MM-DD> \
#   --description <text> --ext <pdf|jpg|...>
exec node "$(dirname "$0")/../dist/save-attachment.js" "$@"
