#!/bin/bash
# SessionStart hook — make a fresh container able to run this repo.
#
# WHY THIS EXISTS. A Claude Code on the web session starts in a container whose
# Bun is whatever the image ships, and this repo pins its own in `.bun-version`.
# When those disagree across a lockfile-format boundary the repo does not merely
# degrade, it stops working entirely: `bun.lock` is lockfileVersion 2, a Bun that
# predates it fails `bun install --frozen-lockfile` with "Unknown lockfile
# version", and from there every `bun run` script, both lefthook hooks and the
# /triage skill are inert. `node_modules` never gets populated, so even commands
# that do not need the lockfile fail on missing binaries.
#
# That is not a hypothetical: it is how the repo was found in an audit session,
# where the toolchain had to be installed by hand before any check could run.
#
# DESIGN RULES.
#   * Idempotent and cheap when already correct — the common case is a no-op.
#   * NEVER fails the session. A hook that blocks startup on a network hiccup is
#     worse than the problem it solves, so every failure prints a diagnosis and
#     exits 0. `tools/check-bun-version.ts` is the hard guard; this is the fixer.
#   * Never writes to tracked files. `--frozen-lockfile` does no resolution and
#     cannot rewrite `bun.lock`.

set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}" || exit 0

[ -f .bun-version ] || exit 0
WANT="$(tr -d '[:space:]' < .bun-version)"
HAVE="$(bun --version 2>/dev/null || echo none)"

note() { echo "[session-start] $*"; }

if [ "$HAVE" != "$WANT" ]; then
  note "Bun $HAVE present, repo pins $WANT — installing the pinned version."
  PREFIX="${HOME}/.local/share/su-srd-bun/${WANT}"
  if [ ! -x "${PREFIX}/bun" ]; then
    mkdir -p "$PREFIX"
    # GitHub releases rather than bun.sh/install: some sandboxes allow the
    # former and deny the latter, and this needs one exact version, not a
    # version resolver.
    case "$(uname -m)" in
      x86_64) ARCH=x64 ;;
      aarch64 | arm64) ARCH=aarch64 ;;
      *) note "unsupported architecture $(uname -m); leaving Bun alone." && exit 0 ;;
    esac
    URL="https://github.com/oven-sh/bun/releases/download/bun-v${WANT}/bun-linux-${ARCH}.zip"
    if curl -fsSL --max-time 180 -o "${PREFIX}/bun.zip" "$URL" &&
      unzip -oq "${PREFIX}/bun.zip" -d "$PREFIX" &&
      mv -f "${PREFIX}/bun-linux-${ARCH}/bun" "${PREFIX}/bun"; then
      chmod +x "${PREFIX}/bun"
      rm -rf "${PREFIX}/bun.zip" "${PREFIX}/bun-linux-${ARCH}"
    else
      note "could not download Bun ${WANT} from ${URL}."
      note "Install it by hand; until then bun.lock may be unreadable and every bun script will fail."
      exit 0
    fi
  fi
  # Persist for later shells in this session. Both are appended because which
  # one a non-interactive tool shell reads varies.
  for rc in "${HOME}/.bashrc" "${HOME}/.profile"; do
    grep -qs "su-srd-bun/${WANT}" "$rc" 2>/dev/null || echo "export PATH=\"${PREFIX}:\$PATH\"" >>"$rc"
  done
  export PATH="${PREFIX}:$PATH"
  note "Bun $(bun --version) is now first on PATH."
fi

if [ ! -d node_modules ] || [ -z "$(ls -A node_modules 2>/dev/null | head -1)" ]; then
  note "installing dependencies (frozen lockfile — bun.lock is not rewritten)…"
  if bun install --frozen-lockfile >/dev/null 2>&1; then
    note "dependencies installed."
  else
    note "bun install --frozen-lockfile FAILED."
    note "If it says 'Unknown lockfile version', the pinned Bun above is older than the"
    note "lockfile; check that .bun-version matches what last wrote bun.lock."
  fi
fi

command -v gh >/dev/null 2>&1 || note "gh is not installed — /triage and any gh-based skill will not work here."

exit 0
