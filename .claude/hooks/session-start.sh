#!/bin/bash
# SessionStart hook — make a fresh container able to run this repo.
#
# WHY THIS EXISTS. A Claude Code on the web session starts in a container whose
# Bun is whatever the image ships, and this repo pins its own in package.json's
# `packageManager`.
# When those disagree across a lockfile-format boundary the repo does not merely
# degrade, it stops working entirely: `bun.lock` is lockfileVersion 2, a Bun that
# predates it fails `bun install --frozen-lockfile` with "Unknown lockfile
# version", and from there every `bun run` script and both lefthook hooks are
# inert. `node_modules` never gets populated, so even commands
# that do not need the lockfile fail on missing binaries.
#
# DESIGN RULES.
#   * Idempotent and cheap when already correct — the common case is a no-op.
#   * NEVER fails the session. A hook that blocks startup on a network hiccup is
#     worse than the problem it solves, so every failure prints a diagnosis and
#     exits 0. In CI, `./.github/actions/setup-bun` installs exactly the pin
#     (it reads `packageManager`); here this is the fixer, and the only one.
#   * Its PATH fix reaches the main agent shell only, not subagent shells, so
#     the packageManager pin should track the image's Bun.
#   * Never writes to tracked files. `--frozen-lockfile` does no resolution and
#     cannot rewrite `bun.lock`.

set -uo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}" || exit 0

# No Bun may be on PATH yet, so the pin is read with sed rather than bun or jq.
WANT="$(sed -n 's/.*"packageManager": *"bun@\([^"]*\)".*/\1/p' package.json 2>/dev/null | head -1)"
[ -n "$WANT" ] || exit 0
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
    case "$(uname -s)" in
      Linux) OS=linux ;;
      Darwin) OS=darwin ;;
      *) note "unsupported OS $(uname -s); leaving Bun alone." && exit 0 ;;
    esac
    case "$(uname -m)" in
      x86_64) ARCH=x64 ;;
      aarch64 | arm64) ARCH=aarch64 ;;
      *) note "unsupported architecture $(uname -m); leaving Bun alone." && exit 0 ;;
    esac
    URL="https://github.com/oven-sh/bun/releases/download/bun-v${WANT}/bun-${OS}-${ARCH}.zip"
    if curl -fsSL --max-time 180 -o "${PREFIX}/bun.zip" "$URL" &&
      unzip -oq "${PREFIX}/bun.zip" -d "$PREFIX" &&
      mv -f "${PREFIX}/bun-${OS}-${ARCH}/bun" "${PREFIX}/bun"; then
      chmod +x "${PREFIX}/bun"
      rm -rf "${PREFIX}/bun.zip" "${PREFIX}/bun-${OS}-${ARCH}"
    else
      note "could not download Bun ${WANT} from ${URL}."
      note "Install it by hand; until then bun.lock may be unreadable and every bun script will fail."
      exit 0
    fi
  fi
  # Persist PATH through $CLAUDE_ENV_FILE, which Claude Code sources before every
  # tool shell. ~/.bashrc cannot carry it: its `[ -z "$PS1" ] && return` guard
  # exits non-interactive tool shells before an appended line runs.
  if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    echo "export PATH=\"${PREFIX}:\$PATH\"" >>"$CLAUDE_ENV_FILE"
  else
    note "CLAUDE_ENV_FILE is unset; later shells will not see Bun ${WANT}."
    note "Prefix commands with: export PATH=\"${PREFIX}:\$PATH\""
  fi
  export PATH="${PREFIX}:$PATH"
  note "Bun $(bun --version) is now first on PATH."
fi

# Install when node_modules is empty OR bun.lock changed since the last install
# (a pull that moves the lockfile otherwise leaves a stale tree behind). The
# stamp lives inside node_modules, so deleting the tree also clears it.
STAMP=node_modules/.su-srd-lockhash
# sha256sum is GNU; stock macOS has only shasum.
LOCKHASH="$({ sha256sum bun.lock 2>/dev/null || shasum -a 256 bun.lock 2>/dev/null; } | cut -d' ' -f1)"
if [ ! -d node_modules ] || [ -z "$(ls -A node_modules 2>/dev/null | head -1)" ] ||
  [ "$(cat "$STAMP" 2>/dev/null)" != "$LOCKHASH" ]; then
  note "installing dependencies (frozen lockfile — bun.lock is not rewritten)…"
  LOG="$(mktemp)"
  if bun install --frozen-lockfile >"$LOG" 2>&1; then
    echo "$LOCKHASH" >"$STAMP"
    note "dependencies installed."
  else
    note "bun install --frozen-lockfile FAILED. Last lines:"
    tail -15 "$LOG" | sed 's/^/[session-start]   /'
    note "If it says 'Unknown lockfile version', the pinned Bun above is older than the"
    note "lockfile; check that packageManager matches what last wrote bun.lock."
  fi
  rm -f "$LOG"
fi

# A cloud session has no Convex login, so `convex dev` (and with it
# `bun run dev:cantina`) would stop at the sign-in prompt. Anonymous agent mode runs
# a local deployment with no account, which `apps/cantina/scripts/assert-local-convex.ts`
# already accepts. Cloud only: on a laptop it would bypass the configured project.
if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ] && [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo 'export CONVEX_AGENT_MODE=anonymous' >>"$CLAUDE_ENV_FILE"
fi

# The cloud environment's one secret is a 1Password service-account token
# (docs/ops/cloud-environment.md item 12); `op` turns the repo's `op://SUSRD/…`
# references into values. The setup script runs this hook as root, so the
# binary lands in the snapshot and later sessions skip the download.
OP_VERSION=2.30.3
if [ -n "${OP_SERVICE_ACCOUNT_TOKEN:-}" ] && ! command -v op >/dev/null 2>&1; then
  OP_TMP="$(mktemp -d)"
  OP_URL="https://cache.agilebits.com/dist/1P/op2/pkg/v${OP_VERSION}/op_linux_$(dpkg --print-architecture 2>/dev/null || echo amd64)_v${OP_VERSION}.zip"
  if curl -fsSL --max-time 60 -o "$OP_TMP/op.zip" "$OP_URL" && unzip -oq "$OP_TMP/op.zip" -d "$OP_TMP" &&
    install -m 0755 "$OP_TMP/op" /usr/local/bin/op 2>/dev/null; then
    note "1Password CLI $(op --version) installed."
  else
    note "could not install the 1Password CLI from ${OP_URL}."
  fi
  rm -rf "$OP_TMP"
fi

command -v gh >/dev/null 2>&1 ||
  note "gh is not installed — use the GitHub MCP tools (mcp__github__*) instead of gh-based steps."

exit 0
