#!/bin/bash
# SessionStart hook — tell the agent where things stand.
#
# WHY THIS EXISTS. session-start.sh fixes the toolchain and says nothing, so an
# agent's first moves were `gh run list` / `gh pr list` to orient itself — and
# in a cloud session those are GraphQL calls the GitHub proxy answers with 403.
# This prints the same orientation once, through `gh api` REST, which answers.
#
# DESIGN RULES.
#   * NEVER fails the session and never prints an error: offline, no gh, a 403
#     or a slow API each print a one-line "unavailable" and the hook exits 0.
#   * Fast: the fetch and both API calls run in parallel under one DEADLINE
#     (seconds), so the hook is bounded at about that whatever the network does.
#   * Writes nothing tracked: the only write is refreshing origin/main (a
#     remote-tracking ref) inside the same deadline, falling back to the last fetch.

set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}" || exit 0

DEADLINE="${SU_STATUS_DEADLINE:-3}"
note() { echo "[status] $*"; }

BRANCH="$(git symbolic-ref --quiet --short HEAD 2>/dev/null)"
note "branch: ${BRANCH:-detached at $(git rev-parse --short HEAD 2>/dev/null || echo '?')}"

# owner/repo from the origin URL: https, ssh and the cloud git proxy all end in it.
REPO="$(git remote get-url origin 2>/dev/null | sed -E 's#\.git$##; s#^.*[/:]([^/:]+/[^/]+)$#\1#')"

TMP="$(mktemp -d 2>/dev/null)" || exit 0
trap 'rm -rf "$TMP"' EXIT

# Run "$@" into $TMP/<name>, never prompting, killed at the deadline. The
# watchdog's output goes to /dev/null so its orphaned sleep cannot hold the
# hook's stdout open.
fetch() {
  local name="$1"
  shift
  GIT_TERMINAL_PROMPT=0 GIT_SSH_COMMAND="${GIT_SSH_COMMAND:-ssh} -o BatchMode=yes" "$@" </dev/null >"$TMP/$name" 2>/dev/null &
  local pid=$!
  (sleep "$DEADLINE" && kill "$pid") >/dev/null 2>&1 &
  local dog=$!
  wait "$pid" && touch "$TMP/$name.ok"
  kill "$dog" 2>/dev/null
}

fetch main git fetch --quiet --no-tags origin main &
HAVE_GH=""
command -v gh >/dev/null 2>&1 && [ -n "$REPO" ] && HAVE_GH=1
if [ -n "$HAVE_GH" ] && [ -n "$BRANCH" ]; then
  fetch pr gh api "repos/$REPO/pulls?state=open&head=${REPO%%/*}:$BRANCH" \
    --jq '.[0] // empty | "#\(.number) \(.title)\(if .draft then " (draft)" else "" end) → \(.base.ref) \(.html_url)"' &
fi
[ -n "$HAVE_GH" ] && fetch e2e gh api "repos/$REPO/actions/workflows/e2e-nightly.yml/runs?branch=main&per_page=1" \
  --jq '.workflow_runs[0] // empty | "\(.conclusion // .status) \(.created_at[:10]) \(.html_url)"' &
wait

if COUNTS="$(git rev-list --left-right --count origin/main...HEAD 2>/dev/null)"; then
  read -r BEHIND AHEAD <<<"$COUNTS"
  FRESH="just fetched"
  [ -e "$TMP/main.ok" ] || FRESH="fetch failed; as of the last fetch"
  [ "$(git rev-parse --is-shallow-repository 2>/dev/null)" = true ] && FRESH="$FRESH; shallow clone"
  note "vs origin/main (${FRESH}): ${AHEAD} ahead, ${BEHIND} behind"
else
  note "vs origin/main: unavailable (origin/main could not be fetched)"
fi

if [ -z "$HAVE_GH" ]; then
  note "open PR: unavailable (no gh or no origin)"
  note "nightly E2E: unavailable (no gh or no origin)"
  exit 0
fi

if [ -z "$BRANCH" ]; then
  note "open PR: none (detached HEAD)"
elif [ ! -e "$TMP/pr.ok" ]; then
  note "open PR: unavailable (gh api failed or timed out)"
else
  note "open PR: $(head -1 "$TMP/pr" | grep . || echo none for this branch)"
fi

if [ ! -e "$TMP/e2e.ok" ]; then
  note "nightly E2E: unavailable (gh api failed or timed out)"
else
  note "nightly E2E: $(head -1 "$TMP/e2e" | grep . || echo no runs yet)"
fi

exit 0
