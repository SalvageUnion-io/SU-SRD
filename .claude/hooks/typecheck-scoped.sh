#!/bin/bash
# PostToolUse hook for Edit and Write: typecheck the edited workspace and its
# consumers after a TypeScript edit.
#
# The edited file maps to a set of projects (see `case "$REL"` below), checked
# by ONE `tsc -b` — never one process per project, which would race to build
# the shared libraries' declarations into `.tsbuild/`. A referenced library is
# built first only when it is out of date; a library edit that changes its
# declarations re-checks its consumers.
#
# A scoped edit also leaves a marker in the git dir, so `typecheck-full.sh`
# (the Stop hook) runs the whole-repo typecheck once at the end of the turn and
# catches anything the map misses.
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

# The edited project plus every project that imports it. `tools` typechecks
# `test/` too and imports every package; srd's and cantina's e2e configs import
# `packages/gates`.
# Repo-root config belongs to no project — leave it to CI.
case "$REL" in
  packages/salvageunion-reference/*) TARGETS="*" ;;
  packages/component-lib/*) TARGETS="packages/component-lib apps/srd apps/cantina tools" ;;
  packages/observability/*) TARGETS="packages/observability apps/discord-bot apps/cantina apps/srd apps/su-assets tools" ;;
  packages/cantina-domain/*) TARGETS="packages/cantina-domain apps/discord-bot apps/cantina tools" ;;
  apps/discord-bot/*) TARGETS="apps/discord-bot" ;;
  apps/cantina/*) TARGETS="apps/cantina" ;;
  apps/srd/*) TARGETS="apps/srd" ;;
  apps/su-assets/*) TARGETS="apps/su-assets" ;;
  packages/gates/*) TARGETS="packages/gates apps/srd apps/cantina tools" ;;
  tools/* | test/*) TARGETS="tools" ;;
  *) exit 0 ;;
esac

if [ "$TARGETS" = "*" ]; then
  OUTPUT=$(bun run typecheck 2>&1)
  STATUS=$?
else
  # The root script with paths appended: `tsc -b <projects>`.
  # shellcheck disable=SC2086 # TARGETS is a space-separated list of paths
  OUTPUT=$(bun run typecheck $TARGETS 2>&1)
  STATUS=$?
  # Ask the Stop hook for one whole-repo pass at the end of the turn.
  touch "$(git rev-parse --git-path claude-typecheck-pending)" 2>/dev/null
fi

if [ "$STATUS" -ne 0 ]; then
  {
    echo "Typecheck ($TARGETS) failed after editing $FILE_PATH:"
    echo "$OUTPUT" | tail -20
  } >&2
  exit 2
fi

exit 0
