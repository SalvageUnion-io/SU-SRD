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
# Never exits non-zero: a typecheck failure here is INFORMATION for the agent,
# not a gate. Exiting 2 would reject an edit that is legitimately mid-refactor
# and half-typed, which is a normal state to be in between two Edit calls.

INPUT=$(cat)

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.file // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Only TypeScript-bearing sources can change a type. Astro files carry a
# TypeScript frontmatter block, so they count; .md/.json/.yml/.css do not.
case "$FILE_PATH" in
  *.ts | *.tsx | *.mts | *.cts | *.astro) : ;;
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
  # tools/, scripts and repo-root config belong to no workspace. The root
  # tsconfig does not typecheck them as a project, and the full matrix would
  # cost 7 s to prove nothing about the edited file — leave them to CI.
  *) exit 0 ;;
esac

bun --filter "$WORKSPACE" typecheck 2>&1 | tail -20

exit 0
