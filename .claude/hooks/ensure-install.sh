#!/bin/bash
# Sourced by the typecheck hooks (not a hook itself): `ensure_install` runs
# `bun install --frozen-lockfile` in the current directory (the checkout root)
# when it has no node_modules.
#
# A worktree created mid-session has no node_modules (SessionStart installs
# only at session start), so a typecheck would fail on a missing tsc. Install
# once; from then on node_modules exists. A failed install prints its tail to
# stderr and returns 2, the caller exits with it, and the next run tries again.

ensure_install() {
  [ -d node_modules ] && return 0
  local output
  if ! output=$(bun install --frozen-lockfile 2>&1); then
    {
      echo "bun install --frozen-lockfile failed in $PWD:"
      echo "$output" | tail -10
    } >&2
    return 2
  fi
}
