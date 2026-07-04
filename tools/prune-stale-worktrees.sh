#!/usr/bin/env bash
#
# prune-stale-worktrees.sh — safely reclaim disk from abandoned agent worktrees
# under .claude/worktrees/.
#
# Background: agent/background-job runs create git worktrees under
# .claude/worktrees/. When a run is abandoned its worktree lingers on disk —
# each is a full checkout that pollutes repo-wide `find`/`grep` and eats disk.
#
# This script is DRY-RUN BY DEFAULT and refuses to touch anything unsafe. It
# NEVER uses `rm -rf`; removal goes through `git worktree remove` so git's own
# safety checks apply. It skips, unconditionally:
#   - the main working tree
#   - the worktree you are currently standing in
#   - any worktree marked `locked` (an active run holds it)
#   - any worktree with uncommitted changes (dirty working tree)
#
# Usage:
#   tools/prune-stale-worktrees.sh            # dry-run: list what WOULD be removed
#   tools/prune-stale-worktrees.sh --force    # actually remove the safe candidates
#
# Recommendation: run the dry-run first, eyeball the list, then re-run with
# --force. When in doubt, leave it — a stale worktree costs disk; removing an
# active one costs another job its work.
set -euo pipefail

FORCE=0
[[ "${1:-}" == "--force" ]] && FORCE=1

# The worktree the script is being run from (skip it, never self-remove).
current_wt="$(git rev-parse --show-toplevel)"
# The main working tree is the first entry in the porcelain list.
main_wt="$(git worktree list --porcelain | awk '/^worktree /{print $2; exit}')"

removed=0
skipped=0

process() {
  local p="$1" lk="$2"
  [[ -z "$p" ]] && return
  # Only consider worktrees under .claude/worktrees/
  case "$p" in
    */.claude/worktrees/*) : ;;
    *) return ;;
  esac
  if [[ "$p" == "$main_wt" || "$p" == "$current_wt" ]]; then
    echo "skip (current/main):   $p"; ((skipped++)) || true; return
  fi
  if [[ "$lk" == "1" ]]; then
    echo "skip (locked/active):  $p"; ((skipped++)) || true; return
  fi
  if [[ -n "$(git -C "$p" status --porcelain 2>/dev/null)" ]]; then
    echo "skip (uncommitted):    $p"; ((skipped++)) || true; return
  fi
  if [[ "$FORCE" == "1" ]]; then
    if git worktree remove "$p" 2>/dev/null; then
      echo "REMOVED:               $p"; ((removed++)) || true
    else
      echo "skip (git refused):    $p"; ((skipped++)) || true
    fi
  else
    echo "would remove:          $p"; ((removed++)) || true
  fi
}

path=""
locked=0
while IFS= read -r line; do
  case "$line" in
    "worktree "*) [[ -n "$path" ]] && process "$path" "$locked"; path="${line#worktree }"; locked=0 ;;
    "locked"*)    locked=1 ;;
    "")           process "$path" "$locked"; path=""; locked=0 ;;
  esac
done < <(git worktree list --porcelain; echo "")

git worktree prune

echo "---"
if [[ "$FORCE" == "1" ]]; then
  echo "removed: $removed   skipped: $skipped"
else
  echo "dry-run: $removed candidate(s), $skipped skipped. Re-run with --force to remove."
fi
