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
  "packages/salvageunion-reference/schemas/*.schema.json"
  "packages/salvageunion-reference/dist/"
  "routeTree.gen.ts"
  "database-generated.types.ts"
  "/dist/"
  "tsconfig.tsbuildinfo"
)

for pattern in "${PROTECTED_PATTERNS[@]}"; do
  if [[ "$FILE_PATH" == *"$pattern"* ]]; then
    echo "BLOCKED: $FILE_PATH is auto-generated. For JSON schemas, edit the Zod schemas in lib/schemas/ and run 'bun run build:package'. For dist/, run 'bun run build:package'. For routeTree.gen.ts, TanStack Router generates this automatically. For database-generated.types.ts, run the Supabase type generation." >&2
    exit 2
  fi
done

exit 0
