#!/bin/bash
# Blocks npm, yarn and pnpm. This project uses bun exclusively.
# Used as a PreToolUse hook for the Bash tool.
#
# WHY ONE PATTERN AND NOT TWO ANCHORED ONES.
# This used to be two regexes — `^\s*(npm|yarn)\s` and
# `(&&|\|\||;)\s*(npm|yarn)\s` — which between them recognised the token only at
# the start of a line or right after `&&`, `||` or `;`. Anything else in front of
# it slipped through. Measured, all exit 0 before this change:
#
#   sudo npm install          bunx npm install         ( npm install )
#   x=1 npm install           for i in 1; do npm i; done
#   bash -c "npm install"     $(which npm) install     echo x | npm install
#   npm                       (bare, no trailing space — fails the \s)
#
# Most of those are noise: `Bash(npm *)` is in `deny` and a `sudo`/subshell form
# matches no `allow` entry either, so they fall to a permission prompt rather
# than running silently. TWO are not noise, and they are why this was rewritten:
#
#   * `bunx npm install` — `Bash(bunx *)` IS in `allow`, so this was the one
#     form permitted by BOTH layers with no prompt at all.
#   * `echo x | npm install` — a single pipe, which the old comment claimed to
#     cover ("piped or chained") and did not.
#
# The pattern below matches the token after ANY shell metacharacter or
# whitespace, or at the start of the string, and no longer requires a trailing
# space — so a bare `npm` is caught too.
#
# WHAT THIS DELIBERATELY DOES NOT CATCH, and why that is fine.
# A token inside a quoted string — `bash -c "<pm> install"` — still passes. It
# is not chased, for two reasons. Nobody types that by accident: it is a
# deliberate evasion, and a deliberate evader can equally split the token across
# a concatenation, which no regex closes. And extending the character class to
# quotes buys nothing against that while making ordinary prose harder to write.
#
# This guards a CONVENTION, not a security boundary: it catches habits and
# accidents, not adversaries. An agent that genuinely needs the other tool can
# be told to by a human, and the `deny` entry in `.claude/settings.json` is the
# real control. The point is to stop an accidental install writing a
# package-lock.json and a node_modules tree that disagree with bun.lock.
#
# `tools/__tests__/claude-hooks.test.ts` pins every case above — including the
# ones that are deliberately allowed, so the boundary is asserted rather than
# assumed.

set -uo pipefail

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [ -z "$COMMAND" ]; then
  exit 0
fi

# `(^|[;&|(){}<>`$]|\s)` — start of string, a shell metacharacter, or any
# whitespace. `($|\s)` — end of string or whitespace, so bare `npm` matches.
if echo "$COMMAND" | grep -qE '(^|[;&|(){}<>`$]|[[:space:]])(npm|yarn|pnpm)($|[[:space:]])'; then
  echo "BLOCKED: this project uses bun, not npm/yarn/pnpm." >&2
  echo "" >&2
  echo "  install        -> bun install" >&2
  echo "  add a dep      -> cd <workspace> && bun add <pkg>   (2+ manifests: use workspaces.catalog)" >&2
  echo "  run a script   -> bun run <script>" >&2
  echo "  one-off binary -> bunx <pkg>        (but NOT 'bunx npm ...', which is what this catches)" >&2
  echo "" >&2
  echo "  An npm install here writes a package-lock.json and a node_modules tree that" >&2
  echo "  disagree with bun.lock. See docs/architecture/dependency-management.md." >&2
  exit 2
fi

exit 0
