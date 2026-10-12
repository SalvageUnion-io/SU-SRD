#!/bin/bash
# PostToolUse hook for Edit and Write: typecheck the edited workspace and its
# consumers after a TypeScript edit.
#
# The edited file maps to a set of workspaces (see `case "$REL"` below), run
# with `bun --filter`. Measured warm (TS 7, incremental): itun ~1.7 s, srd
# ~1.2 s, discord-bot ~0.6 s, tools ~0.7 s; a component-lib edit (four
# projects) ~3.8 s; a salvageunion-reference edit runs every project, ~4.7 s.
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

# The edited workspace plus every workspace that imports it. `tools` typechecks
# `test/` too and imports every package; srd's and itun's e2e configs import
# `tools/lib`. Repo-root config belongs to no project — leave it to CI.
case "$REL" in
  packages/salvageunion-reference/*) TARGETS="*" ;;
  packages/component-lib/*) TARGETS="component-lib srd itun tools" ;;
  packages/observability/*) TARGETS="observability discord-bot itun srd su-assets tools" ;;
  packages/itun-domain/*) TARGETS="itun-domain discord-bot itun tools" ;;
  apps/discord-bot/*) TARGETS="discord-bot" ;;
  apps/itun/*) TARGETS="itun" ;;
  apps/srd/*) TARGETS="srd" ;;
  apps/su-assets/*) TARGETS="su-assets" ;;
  tools/lib/*) TARGETS="tools srd itun" ;;
  tools/* | test/*) TARGETS="tools" ;;
  *) exit 0 ;;
esac

if [ "$TARGETS" = "*" ]; then
  OUTPUT=$(bun run typecheck 2>&1)
  STATUS=$?
else
  FILTERS=()
  for target in $TARGETS; do FILTERS+=(--filter "$target"); done
  OUTPUT=$(bun "${FILTERS[@]}" typecheck 2>&1)
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
