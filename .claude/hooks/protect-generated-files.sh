#!/bin/bash
# Blocks edits to auto-generated files.
# Used as a PreToolUse hook for Edit and Write tools.
#
# WHY THE MATCH IS A `case` AND NOT `[[ == *"$pattern"* ]]`.
# The original form quoted the pattern, which makes `*` inside it a LITERAL
# asterisk rather than a glob. Exactly one entry contained a wildcard —
# `schemas/*.schema.json` — so exactly one entry never matched anything, and it
# was the one this hook's own error message is mostly about. The result was an
# asymmetry nobody could see: `dist/` was covered twice over (its own entry plus
# `/dist/`), while the JSON schemas, which CI fails on for drift, were covered
# zero times. `case` globs the pattern, which is what was always intended.
#
# Exit 2 is the PreToolUse blocking contract; exit 0 allows the edit.

set -uo pipefail

INPUT=$(cat)

# `notebook_path` is deliberately included: the PreToolUse matcher `Edit|Write`
# substring-matches NotebookEdit too, and that tool passes a different key. It
# previously fell through to the empty-path early exit, i.e. allowed silently.
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.file // .tool_input.notebook_path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Auto-generated files that must not be hand-edited.
#
# Keep this in step with what `bun run check:schemas` diffs and what the build
# regenerates — a path that CI fails on for drift but that is missing here is a
# trap: the agent edits it, the edit looks accepted, and CI rejects it later
# with a message about drift rather than about the edit.
PROTECTED_PATTERNS=(
  "*packages/salvageunion-reference/schemas/*.schema.json"
  "*packages/salvageunion-reference/docs/*"
  "*packages/salvageunion-reference/lib/generated/*"
  "*packages/salvageunion-reference/etc/*"
  "*packages/salvageunion-reference/dist/*"
  "*routeTree.gen.ts"
  "*database-generated.types.ts"
  "*/dist/*"
  "*tsconfig.tsbuildinfo"
  # Generated or machine-managed, and all previously unprotected.
  "*apps/itun/convex/_generated/*"
  "*apps/srd/ssg/output-snapshot.json"
  "*bun.lock"
  "*coverage-baseline.json"
  "*tools/a11y-baseline.json"
  "*tools/design-tokens-baseline.json"
  "*tools/styling-ownership-baseline.json"
  "*.vscode/settings.json"
)

for pattern in "${PROTECTED_PATTERNS[@]}"; do
  # shellcheck disable=SC2254 # $pattern is intentionally a glob, not a literal
  case "$FILE_PATH" in
    $pattern)
      echo "BLOCKED: $FILE_PATH is auto-generated and must not be hand-edited." >&2
      echo "" >&2
      echo "  JSON schemas / docs / lib/generated / etc: edit the Zod schemas in" >&2
      echo "  packages/salvageunion-reference/lib/schemas/ and run 'bun run build:package'." >&2
      echo "  routeTree.gen.ts: TanStack Router regenerates it." >&2
      echo "  output-snapshot.json: run 'bun --filter srd snapshot:update' and READ the diff." >&2
      echo "  bun.lock: change the manifest and let the resolver rewrite it." >&2
      echo "  baselines: these ratchet down on their own; do not edit to make a check pass." >&2
      exit 2
      ;;
  esac
done

exit 0
