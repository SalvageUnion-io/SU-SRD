#!/bin/bash
# Blocks npm and yarn commands. This project uses bun exclusively.
# Used as a PreToolUse hook for Bash tool.

INPUT=$(cat)

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [ -z "$COMMAND" ]; then
  exit 0
fi

# Block npm commands (but not references in comments/strings)
if echo "$COMMAND" | grep -qE '^\s*(npm|yarn)\s'; then
  echo "BLOCKED: This project uses bun, not npm/yarn. Use the equivalent bun command instead." >&2
  exit 2
fi

# Also block if piped or chained with npm/yarn at start of a subcommand
if echo "$COMMAND" | grep -qE '(&&|\|\||;)\s*(npm|yarn)\s'; then
  echo "BLOCKED: This project uses bun, not npm/yarn. Use the equivalent bun command instead." >&2
  exit 2
fi

exit 0
