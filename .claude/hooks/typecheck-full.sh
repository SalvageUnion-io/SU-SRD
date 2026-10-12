#!/bin/bash
# Stop hook: the whole-repo `bun run typecheck` (~4.7 s warm), once per turn
# and only when `typecheck-scoped.sh` checked a scoped set during it. It is the
# backstop for any consumer the per-edit map misses.
#
# Silent on success. On failure the tail goes to stderr with exit 2, which
# keeps Claude working on the errors. The marker stays until a run passes, and
# a stop that a Stop hook already continued (`stop_hook_active`) is let
# through, so a failure cannot loop.

INPUT=$(cat)

if [ "$(echo "$INPUT" | jq -r '.stop_hook_active // false')" = "true" ]; then
  exit 0
fi

unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE
ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$ROOT" || exit 0
MARKER=$(git rev-parse --path-format=absolute --git-path claude-typecheck-pending 2>/dev/null) || exit 0

if [ ! -e "$MARKER" ]; then
  exit 0
fi

OUTPUT=$(bun run typecheck 2>&1)
STATUS=$?

if [ "$STATUS" -ne 0 ]; then
  {
    echo "Whole-repo typecheck failed at the end of the turn:"
    echo "$OUTPUT" | tail -20
  } >&2
  exit 2
fi

rm -f "$MARKER"
exit 0
