#!/bin/bash
# PostToolUse hook for Edit and Write: the whole-repo `bun run typecheck` after
# a TypeScript edit in a workspace. It is one incremental `tsc -b` over the
# four projects (root tsconfig.json), so only a project whose sources changed
# is re-checked: an app edit re-checks that app, a package edit the root
# project and the apps that import it.
#
# Silent on success. On failure the tail goes to stderr with exit 2, which
# Claude Code feeds back to the model; PostToolUse cannot undo the edit, so a
# mid-refactor state is reported, not rejected.

INPUT=$(cat)

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.file // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Only TypeScript sources can change a type; .md/.json/.yml/.css cannot.
case "$FILE_PATH" in
  *.ts | *.tsx | *.mts | *.cts) : ;;
  *) exit 0 ;;
esac

# Run from the checkout that owns the file. A GIT_DIR inherited from a git hook
# would override `-C` and name the wrong repo.
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE
DIR=$(cd "$(dirname "$FILE_PATH")" 2>/dev/null && pwd -P) || exit 0
ROOT=$(git -C "$DIR" rev-parse --show-toplevel 2>/dev/null) || exit 0
ROOT=$(cd "$ROOT" && pwd -P)
REL="${DIR#"$ROOT"}/$(basename "$FILE_PATH")"
REL="${REL#/}"
cd "$ROOT" || exit 0

# A worktree created mid-session has no node_modules yet: install it once.
# shellcheck source=ensure-install.sh
. "$(dirname "${BASH_SOURCE[0]}")/ensure-install.sh"
ensure_install || exit 2

# Repo-root config belongs to no project: leave it to CI.
case "$REL" in
  apps/* | packages/* | tools/*) : ;;
  *) exit 0 ;;
esac

OUTPUT=$(bun run typecheck 2>&1)
STATUS=$?

if [ "$STATUS" -ne 0 ]; then
  {
    echo "Typecheck failed after editing $FILE_PATH:"
    echo "$OUTPUT" | tail -20
  } >&2
  exit 2
fi

exit 0
