#!/usr/bin/env bash
# lint-workflows — actionlint + zizmor over .github/, each pinned to an exact
# version AND verified against a recorded sha256 before it runs.
#
#   bun run lint:workflows
#
# actionlint catches what YAML validity does not: bad expressions, unknown
# `needs:` / output references, and (via shellcheck, when it is on PATH —
# it is on GitHub's ubuntu runners) bugs inside `run:` scripts. zizmor is the
# security half: template injection, credential persistence, unpinned actions
# and dangerous triggers. Its config is `.github/zizmor.yml`.
#
# WHY A SCRIPT AND NOT `go run` / `pipx run`: this repo refuses to execute a
# fetched tool it cannot pin (tools/check-action-pinning.ts). A version string
# alone is a pointer; the hash below is the artifact. Both tools are fetched
# once per version into a user cache and reused, so a local re-run is instant.
#
# BUMPING: change the version, then replace every hash for that tool from the
# upstream release — actionlint's `actionlint_<v>_checksums.txt` release asset,
# zizmor's `https://pypi.org/pypi/zizmor/<v>/json` (`digests.sha256` per wheel).
#
# LOCALLY it needs network access (first run only) and python3. Without either
# it skips with a notice and exits 0, so `bun run check` still works offline;
# in CI (`CI` set) a missing prerequisite or failed fetch is a hard failure.
set -euo pipefail

# Skip with a notice locally; fail in CI, where the gate must actually run.
skip_or_fail() {
  if [ -n "${CI:-}" ]; then
    echo "lint-workflows: $1" >&2
    exit 1
  fi
  echo "lint-workflows: SKIPPED locally — $1 (CI runs it)." >&2
  exit 0
}

command -v curl >/dev/null 2>&1 || skip_or_fail "curl is not installed"
command -v python3 >/dev/null 2>&1 || skip_or_fail "python3 is not installed"

ACTIONLINT_VERSION=1.7.12
ZIZMOR_VERSION=1.30.1

root=$(cd "$(dirname "$0")/.." && pwd)
cache="${XDG_CACHE_HOME:-$HOME/.cache}/su-srd-workflow-lint"
mkdir -p "$cache"

case "$(uname -s)" in
  Linux) os=linux ;;
  Darwin) os=darwin ;;
  *) echo "lint-workflows: unsupported OS $(uname -s)" >&2; exit 1 ;;
esac
case "$(uname -m)" in
  x86_64 | amd64) arch=amd64 ;;
  aarch64 | arm64) arch=arm64 ;;
  *) echo "lint-workflows: unsupported architecture $(uname -m)" >&2; exit 1 ;;
esac

sha256() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

# ---------------------------------------------------------------- actionlint
case "${os}_${arch}" in
  linux_amd64) al_sha=8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8 ;;
  linux_arm64) al_sha=325e971b6ba9bfa504672e29be93c24981eeb1c07576d730e9f7c8805afff0c6 ;;
  darwin_amd64) al_sha=5b44c3bc2255115c9b69e30efc0fecdf498fdb63c5d58e17084fd5f16324c644 ;;
  darwin_arm64) al_sha=aba9ced2dee8d27fecca3dc7feb1a7f9a52caefa1eb46f3271ea66b6e0e6953f ;;
esac
actionlint="$cache/actionlint-$ACTIONLINT_VERSION"
if [ ! -x "$actionlint" ]; then
  tarball="$cache/actionlint_${ACTIONLINT_VERSION}_${os}_${arch}.tar.gz"
  curl -sSfL -o "$tarball" \
    "https://github.com/rhysd/actionlint/releases/download/v${ACTIONLINT_VERSION}/actionlint_${ACTIONLINT_VERSION}_${os}_${arch}.tar.gz" ||
    { rm -f "$tarball"; skip_or_fail "could not download actionlint (no network?)"; }
  got=$(sha256 "$tarball")
  if [ "$got" != "$al_sha" ]; then
    echo "lint-workflows: actionlint tarball sha256 mismatch (got $got, want $al_sha)" >&2
    rm -f "$tarball"
    exit 1
  fi
  tar -xzf "$tarball" -C "$cache" actionlint
  mv "$cache/actionlint" "$actionlint"
  rm -f "$tarball"
fi

# -------------------------------------------------------------------- zizmor
# Every published wheel's hash is listed, so pip may pick whichever matches the
# platform — and must still find that file's hash here, or it refuses.
zizmor_venv="$cache/zizmor-$ZIZMOR_VERSION"
if [ ! -x "$zizmor_venv/bin/zizmor" ]; then
  rm -rf "$zizmor_venv"
  python3 -m venv "$zizmor_venv" ||
    { rm -rf "$zizmor_venv"; skip_or_fail "python3 cannot create a venv (install python3-venv)"; }
  cat >"$cache/zizmor-requirements.txt" <<EOF
zizmor==${ZIZMOR_VERSION} \\
  --hash=sha256:eee12266b793cb87ad4a7e3af2e72404f8a63e3de5eb099b80bf7b1cfd232a8e \\
  --hash=sha256:92906f448365672ebb657fb50d36f997290a3aaba8cac723214741ea9054845d \\
  --hash=sha256:4a5ef2fa4fbd2984f794cfc2f95790bd03fa0bae801487ed550e044675874e60 \\
  --hash=sha256:15679642e8c4f825ba3f22537c698b1bbbad19ead23640f62ec45ebbe7abc803 \\
  --hash=sha256:17fda74e15fe41a6aa354ea4cf71fc7ff3cd025cda6584bb6d7466b3f1d00fe6 \\
  --hash=sha256:f9eb092f089e35fa9fb3b70aeec0a19eca7dacf2ab161f1d50b18351895f085c
EOF
  "$zizmor_venv/bin/pip" install --quiet --disable-pip-version-check \
    --require-hashes --only-binary=:all: -r "$cache/zizmor-requirements.txt" ||
    { rm -rf "$zizmor_venv"; skip_or_fail "could not install zizmor (no network, or a wheel hash mismatch)"; }
fi

cd "$root"
status=0

echo "actionlint $ACTIONLINT_VERSION"
"$actionlint" || status=1

echo "zizmor $ZIZMOR_VERSION"
# --offline: every audit this repo gates on is static. An EMPTY GH_TOKEN is a
# hard argument error in zizmor, so drop the variable rather than pass "".
if [ -z "${GH_TOKEN:-}" ]; then unset GH_TOKEN; fi
if [ -z "${GITHUB_TOKEN:-}" ]; then unset GITHUB_TOKEN; fi
"$zizmor_venv/bin/zizmor" --offline --no-progress .github || status=1

exit "$status"
