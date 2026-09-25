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
# HOW IT DECIDES. The whole command (all lines at once) is scanned with a
# small quote-state machine: heredoc bodies and everything inside single or
# double quotes is dropped. What is left is split into segments at every
# separator (`;` `&` `|` `(` `)` `{` `}` backtick `$(` and newline). A segment
# is blocked when any bare word in it IS a package manager name (a trailing
# `@version` is ignored), so wrappers of every shape are covered without
# keeping a list: `sudo -E <pm>`, `timeout 60 <pm>`, `if <pm> ...`, `! <pm>`,
# `FOO="a b" <pm>`, `bunx <pm>@10`.
#
# Two things are deliberately allowed, because the earlier any-whitespace
# pattern blocked the prose this repo writes about the rule itself:
#   * anything quoted or inside a heredoc, including multi-line commit
#     messages and `gh pr create --body "..."`, which is how agents write them;
#   * a segment whose command only READS or LOOKS UP text (grep, rg, git, gh,
#     ls, cat, echo, which, type...), so `grep -rn <pm> docs` runs.
#
# WHAT THIS DELIBERATELY DOES NOT CATCH, and why that is fine.
# A token inside a quoted string — `bash -c "<pm> install"` — still passes
# (a `$(...)` inside double quotes is scanned as code, since it runs). It
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

PMS=' npm yarn pnpm '
# Commands that only mention or look up text: a package-manager word after one
# of these is an argument, not something being run.
READERS=' grep egrep fgrep rg ag git gh ls cat head tail less more echo printf sed awk wc jq diff cut sort uniq tr tee which type whereis '

# Drop heredoc bodies and quoted text across the WHOLE command, then emit one
# segment per line. Line-at-a-time stripping is not enough: a commit message
# or PR body is a multi-line quoted string.
SEGMENTS=$(printf '%s\n' "$COMMAND" | awk -v q="'" '
  {
    if (hd != "") { t = $0; sub(/^[ \t]+/, "", t); if (t == hd) hd = ""; next }
    line = $0
    # A heredoc opener (not a <<< here-string): keep the command, drop the body.
    if (match(line, "<<-?[ \t]*[\"" q "]?[A-Za-z_][A-Za-z0-9_]*[\"" q "]?") &&
        substr(line, RSTART + 2, 1) != "<" && (RSTART == 1 || substr(line, RSTART - 1, 1) != "<")) {
      w = substr(line, RSTART, RLENGTH)
      sub(/^<<-?[ \t]*/, "", w); gsub(/["\047]/, "", w)
      hd = w
      line = substr(line, 1, RSTART - 1) " " substr(line, RSTART + RLENGTH)
    }
    buf = buf line "\n"
  }
  END {
    # st: 0 = code, 1 = single quotes, 2 = double quotes. A `$(` inside double
    # quotes is CODE again until its matching `)`: `"$(x bin)"` runs x, so
    # the frame stack (ret/dep) remembers where to return and the paren depth.
    out = ""; st = 0; sp = 0; n = length(buf)
    for (i = 1; i <= n; i++) {
      c = substr(buf, i, 1)
      if (st == 0) {
        # A comment runs to end of line; an apostrophe in it is not a quote.
        if (c == "#" && (i == 1 || substr(buf, i - 1, 1) ~ /[ \t\n;&|(]/)) {
          while (i < n && substr(buf, i + 1, 1) != "\n") i++
          continue
        }
        if (c == q) { st = 1; out = out " "; continue }
        if (c == "\"") { st = 2; out = out " "; continue }
        if (c == "\\") { i++; out = out " "; continue }
        if (sp > 0 && c == "(") dep[sp]++
        if (sp > 0 && c == ")") {
          if (dep[sp] == 0) { st = ret[sp]; sp--; out = out ")"; continue }
          dep[sp]--
        }
        out = out c
      } else if (st == 1) {
        if (c == q) st = 0
      } else {
        if (c == "\\") { i++; continue }
        if (c == "$" && substr(buf, i + 1, 1) == "(") {
          sp++; ret[sp] = 2; dep[sp] = 0; st = 0; out = out "$("; i++; continue
        }
        if (c == "\"") st = 0
      }
    }
    # A lookup whose OUTPUT is executed (`$(which x) install`) runs x: rename
    # the lookup so it is not treated as a read-only command below.
    gsub(/(\$\(|`)[ \t]*(which|type -p|command -v)[ \t]/, "$(lookup-then-run ", out)
    gsub(/\$\(|[;&|(){}`]/, "\n", out)
    print out
  }')

blocked=false
while IFS= read -r segment; do
  read -ra words <<<"$segment" || true
  first=""
  for w in ${words[@]+"${words[@]}"}; do
    # Leading env assignments are not the command.
    if [ -z "$first" ] && [[ "$w" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then continue; fi
    [ -z "$first" ] && first="${w##*/}"
    [[ "$READERS" == *" $first "* ]] && break
    # `command -v <pm>` is a lookup; plain `command <pm>` runs it.
    if [ "$first" = command ] && [[ "$w" == -[vV] ]]; then break; fi
    # A bare name anywhere in the segment, or a path to one as the command.
    base="${w##*/}"
    base="${base%%@*}"
    if [[ "$PMS" == *" $base "* ]] && { [ "${w%%@*}" = "$base" ] || [ "$first" = "${w##*/}" ]; }; then
      blocked=true
      break 2
    fi
  done
done <<<"$SEGMENTS"

if $blocked; then
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
