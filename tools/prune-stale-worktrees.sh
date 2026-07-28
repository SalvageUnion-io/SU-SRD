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
#   - any worktree whose lock is held by a LIVE process
#   - any worktree with uncommitted changes (dirty working tree)
#
# Locks: Claude Code stamps its lock reason as
#   "claude session <name> (pid <PID> start <date>)"
# A killed or crashed session never releases that lock, so the worktree stays
# locked forever and this script — which used to skip every locked worktree
# unconditionally — could never reclaim it. That is the backlog described in
# issue #377: the reaper runs, reports nothing to do, and the directories
# accumulate anyway.
#
# So a lock is now interrogated rather than obeyed blindly: parse the PID out
# of the reason, and if that process is GONE the lock is stale — unlock and
# treat the worktree as a normal candidate (it still has to pass every other
# safety check before removal). If the PID is alive, or no PID can be parsed at
# all, skip: an unrecognised lock is somebody else's, and the default answer
# here is always "leave it".
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
  local p="$1" lk="$2" reason="${3:-}"
  # NOTE: every early return here MUST be `return 0`, not a bare `return`.
  # A bare `return` yields the status of the last command run — which for the
  # skip paths is a FAILED test — so `process` returned 1, and under
  # `set -euo pipefail` that killed the whole script at the first worktree it
  # declined to consider. The main working tree is always the first entry, and
  # is always declined, so this script exited 1 with no output before examining
  # a single candidate: it never reclaimed anything, for its entire life. That
  # is the actual reason abandoned worktrees accumulate (issue #377), not the
  # lock handling.
  [[ -z "$p" ]] && return 0
  # Only consider worktrees under .claude/worktrees/
  case "$p" in
    */.claude/worktrees/*) : ;;
    *) return 0 ;;
  esac
  if [[ "$p" == "$main_wt" || "$p" == "$current_wt" ]]; then
    echo "skip (current/main):   $p"; ((skipped++)) || true; return 0
  fi
  if [[ "$lk" == "1" ]]; then
    # Interrogate the lock instead of obeying it blindly (see header). Claude
    # Code stamps "… (pid <PID> start <date>)"; anything else is an unknown
    # holder and is left alone.
    local pid
    pid="$(printf '%s' "$reason" | sed -n 's/.*[Pp]id \([0-9][0-9]*\).*/\1/p')"
    if [[ -z "$pid" ]]; then
      echo "skip (locked, no pid): $p"; ((skipped++)) || true; return 0
    fi
    if ps -p "$pid" >/dev/null 2>&1; then
      echo "skip (locked, pid $pid alive): $p"; ((skipped++)) || true; return 0
    fi
    # Stale: the session that took this lock is gone. Fall through to the
    # ordinary safety checks — a stale lock makes a worktree a CANDIDATE, it
    # does not exempt it from the dirty-tree or git-refusal checks below.
    echo "stale lock (pid $pid gone): $p"
    if [[ "$FORCE" == "1" ]]; then
      git worktree unlock "$p" 2>/dev/null || true
    fi
  fi
  if [[ -n "$(git -C "$p" status --porcelain 2>/dev/null)" ]]; then
    echo "skip (uncommitted):    $p"; ((skipped++)) || true; return 0
  fi
  # Unpushed commits. `git worktree remove` does NOT check this — it only
  # refuses on a dirty tree — so without this guard a worktree holding the only
  # copy of a commit would be deleted. That risk was theoretical while the
  # script exited early and removed nothing; fixing it made the risk real, so
  # the guard ships in the same change.
  #
  # Deliberately conservative: a branch whose commits are not on ANY remote is
  # kept. That also keeps squash-merged branches (whose content landed under a
  # new SHA, so the originals exist nowhere by SHA) — those are safe to delete
  # in principle, but proving it needs patch-id equivalence, and the default
  # answer here is always "leave it".
  if [[ -z "$(git -C "$p" branch -r --contains HEAD 2>/dev/null)" ]]; then
    echo "skip (unpushed):       $p"; ((skipped++)) || true; return 0
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
reason=""
while IFS= read -r line; do
  case "$line" in
    "worktree "*)
      [[ -n "$path" ]] && process "$path" "$locked" "$reason"
      path="${line#worktree }"; locked=0; reason="" ;;
    # Porcelain emits a bare `locked` or `locked <reason>`; the reason carries
    # the holding session's pid, which decides whether the lock is still real.
    "locked")     locked=1; reason="" ;;
    "locked "*)   locked=1; reason="${line#locked }" ;;
    "")           process "$path" "$locked" "$reason"; path=""; locked=0; reason="" ;;
  esac
done < <(git worktree list --porcelain; echo "")

git worktree prune

echo "---"
if [[ "$FORCE" == "1" ]]; then
  echo "removed: $removed   skipped: $skipped"
else
  echo "dry-run: $removed candidate(s), $skipped skipped. Re-run with --force to remove."
fi
