#!/bin/bash
# Typechecks ONLY the workspace an edit actually touched.
# Used as a PostToolUse hook for Edit and Write tools.
#
# This replaces a hook that ran the whole monorepo `bun run typecheck` after
# EVERY Edit and Write — including markdown, JSON and YAML, which cannot affect
# a type. Measured, that is 7.0 s of wall clock per edit, of which apps/srd
# alone is 6.3 s:
#
#   salvageunion-reference 0.10s   component-lib 0.15s   srd 6.27s
#   itun 2.19s             discord-bot 0.96s            total 7.03s (concurrent)
#
# Across a few dozen edits per session that is minutes of pure waiting, paid on
# every session, to re-prove something `bun run typecheck` in CI already gates
# on merge. And because PostToolUse output is advisory — it cannot block the
# edit — the cost bought a warning, not enforcement.
#
# So: skip entirely for files that cannot change a type, and otherwise check
# just the one workspace that owns the file. A cross-package edit still gets
# caught, because the consuming workspace is typechecked the moment you edit a
# file in it, and CI still runs the full matrix on the PR.
#
# HOW THE RESULT REACHES THE AGENT. For a PostToolUse hook, stdout on exit 0 is
# shown only in transcript mode — it never enters the model's context. This hook
# used to print the tsc tail to stdout and always exit 0, so it cost seconds per
# edit to produce output nobody saw. Now: silent on success; on failure, the tail
# goes to stderr with exit 2, which Claude Code feeds back to the model. Exit 2
# does NOT undo the edit (PostToolUse runs after it has happened) — it is a
# message, so a half-typed mid-refactor state is reported, not rejected.

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

# Map the edited path to the workspace that owns it. Ordered most-specific
# first; salvageunion-reference must precede any broader packages/ rule.
case "$FILE_PATH" in
  *packages/salvageunion-reference/*) WORKSPACE="salvageunion-reference" ;;
  *packages/component-lib/*)          WORKSPACE="component-lib" ;;
  *packages/observability/*)          WORKSPACE="observability" ;;
  *apps/srd/*)                        WORKSPACE="srd" ;;
  *apps/itun/*)                       WORKSPACE="itun" ;;
  *apps/discord-bot/*)                WORKSPACE="discord-bot" ;;
  *apps/su-assets/*)                  WORKSPACE="su-assets" ;;
  # tools/ is typechecked as its own project (tsconfig.tools.json).
  *tools/*)                           WORKSPACE="tools" ;;
  # Repo-root config belongs to no project — leave it to CI.
  *) exit 0 ;;
esac

if [ "$WORKSPACE" = "tools" ]; then
  OUTPUT=$(bun run typecheck:tools 2>&1)
else
  OUTPUT=$(bun --filter "$WORKSPACE" typecheck 2>&1)
fi
STATUS=$?

if [ "$STATUS" -ne 0 ]; then
  {
    echo "Typecheck failed in $WORKSPACE after editing $FILE_PATH:"
    echo "$OUTPUT" | tail -20
  } >&2
  exit 2
fi

exit 0
