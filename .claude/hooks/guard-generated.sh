#!/bin/bash
# PreToolUse hook for Edit, Write, MultiEdit and NotebookEdit: generated files
# are never hand-edited (AGENTS.md); their source changes, then the generator
# runs. Exit 2 blocks the edit and feeds stderr back to the model.
#
# A hook rather than `Edit(...)` deny rules in settings.json: Claude Code also
# applies Edit deny rules to the Bash sandbox as write denies, so the
# generators themselves (`ref-generate`, `tsc -b`, `bun install`)
# failed with EPERM inside it. A hook sees only tool calls, so the
# tools stay off these paths while the commands that write them run.

INPUT=$(cat)

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# One leading slash, absolute or repo-relative alike, so every pattern can
# anchor on a path segment. `*` in a case pattern crosses `/`, as `**` does.
P="/${FILE_PATH#/}"

case "$P" in
  */bun.lock)
    echo "$FILE_PATH is Bun's lockfile: change a package.json and run \`bun install\`." >&2
    exit 2
    ;;
  */packages/salvageunion-reference/schemas/* | \
    */packages/salvageunion-reference/lib/generated/* | \
    */routeTree.gen.ts | \
    */worker-configuration.d.ts | \
    */dist/* | \
    *.tsbuildinfo)
    echo "$FILE_PATH is generated: change its source, then run \`bun run check generated\` (or the build that writes it)." >&2
    exit 2
    ;;
esac

exit 0
