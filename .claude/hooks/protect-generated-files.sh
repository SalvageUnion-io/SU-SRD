#!/bin/bash
# Blocks edits to auto-generated files in salvageunion-reference.
# Used as a PreToolUse hook for Edit and Write tools.

# Read tool input from stdin
INPUT=$(cat)

# Extract file_path from the tool input JSON
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.file // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Auto-generated files that must not be manually edited
PROTECTED_PATTERNS=(
  "packages/salvageunion-reference/lib/index.ts"
  "packages/salvageunion-reference/lib/utilities-generated.ts"
  "packages/salvageunion-reference/lib/types/schemas.ts"
  "packages/salvageunion-reference/lib/types/enums.ts"
  "packages/salvageunion-reference/lib/types/common.ts"
  "packages/salvageunion-reference/lib/types/objects.ts"
  "packages/salvageunion-reference/lib/types/index.ts"
  "packages/salvageunion-reference/dist/"
  "routeTree.gen.ts"
)

for pattern in "${PROTECTED_PATTERNS[@]}"; do
  if [[ "$FILE_PATH" == *"$pattern"* ]]; then
    echo "BLOCKED: $FILE_PATH is auto-generated. Edit the generator scripts in tools/ or template files instead, then run 'bun run generate'." >&2
    exit 2
  fi
done

exit 0
