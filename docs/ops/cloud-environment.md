# The `SU-SRD` cloud environment

Configured at claude.ai/code (environment selector → Cloud → Add cloud
environment) and invisible to `grep`; this is its record, so change both
together. No CLI or API edits it.

- **Name:** `SU-SRD`. **Environment variables:** none — never a secret here.
- **Network access:** Custom, with "Also include default list of common package
  managers" ticked (keeps GitHub releases, `registry.npmjs.org` and PyPI, which
  the Bun pin, `bun run audit` and `tools/lint-workflows.sh` need), plus:

  ```text
  mcp.context7.com
  version.convex.dev
  salvageunion.io
  www.salvageunion.io
  assets.salvageunion.io
  intheunionnow.com
  www.intheunionnow.com
  su-srd.alxjrvs.workers.dev
  su-discord-bot.alxjrvs.workers.dev
  cdn.playwright.dev
  playwright.download.prss.microsoft.com
  ```

  The sites are what `tools/smoke-production.sh` and entity artwork reach; the
  Playwright hosts serve `bunx playwright install chromium`, which is left to the
  session that needs it. `version.convex.dev` is where `convex dev` resolves its
  local backend (the binary and dashboard come from `github.com/…/releases/download/`,
  which the package-manager list covers); without it `bun run dev:itun` fails
  "Failed to fetch latest backend version". `--local-backend-version` does not
  avoid it: a new deployment makes its admin key with the newest binary. The
  Cloudflare and Sentry MCP hosts are left out: those `.mcp.json` servers
  authenticate by OAuth, which a cloud session cannot complete. claude.ai
  connectors stand in for them (below).
- **Connectors** (claude.ai → Settings → Connectors; a session reads them at
  start):
  - **Cloudflare Developer Platform** (directory): Workers, R2, KV, D1 — the
    `cloudflare-bindings` equivalent, as `mcp__Cloudflare_Developer_Platform__*`.
  - **Sentry** (directory): the `sentry` equivalent, org `susrd`.
  - **Cloudflare Observability** (custom connector,
    `https://observability.mcp.cloudflare.com/mcp`): Worker logs and errors.
- **Convex:** the SessionStart hook exports `CONVEX_AGENT_MODE=anonymous` in
  cloud sessions, so `bun run dev:itun` starts a local deployment without a
  Convex account and writes `apps/itun/.env.local`; the `convex` MCP server
  answers while it runs. A multi-repo session runs no repo hooks, so there
  prefix it: `CONVEX_AGENT_MODE=anonymous bun run dev:itun`. The test-auth setup in
  [`convex-ops`](../../.claude/skills/convex-ops/SKILL.md#local-backend) is per
  container. In a fresh container, first `cp apps/itun/.env.example
  apps/itun/.env.local`: `vite` is a root dependency, so the CLI misses it and
  writes `CONVEX_URL` instead of `VITE_CONVEX_URL`. That first run then exits
  at Vite (the CLI loaded the empty value before filling it); run it again.
  The image's Playwright Chromium is older than `@playwright/test`'s: run the
  e2e specs with `launchOptions: { executablePath: '/opt/pw-browsers/chromium' }`
  in a throwaway config rather than `playwright install`.
- **Setup script:** runs as root before Claude Code starts and is snapshotted
  when it ends within about five minutes, so the pinned Bun and `node_modules`
  are already in place and the SessionStart hook is a no-op. In a multi-repo
  session repo hooks do not run at all: this script still installs the pinned
  Bun (its `packageManager` test picks the SU-SRD checkout out of the
  siblings), but nothing puts it on `PATH`, so prefix commands with
  `PATH="$HOME/.local/share/su-srd-bun/<version>:$PATH"`. It also caches the
  newest Convex local backend and dashboard where `convex dev` looks
  (`~/.cache/convex`), with curl: the CLI's own Node download of the dashboard
  crashed mid-stream through the egress proxy. A release newer than the
  snapshot is still fetched by the CLI. It must exit 0: a failure stops the
  session starting.

  ```bash
  #!/bin/bash
  # SU-SRD: docs/ops/cloud-environment.md is this script's record.
  # Warm the snapshot with the repo's pinned Bun and node_modules by running
  # its own SessionStart hook. Never fail: the hook fixes things at start anyway.
  for d in "${CLAUDE_PROJECT_DIR:-}" "$PWD" /home/user/* /root/* /workspace/*; do
    if [ -x "$d/.claude/hooks/session-start.sh" ] &&
      grep -q '"packageManager": *"bun@' "$d/package.json" 2>/dev/null; then
      CLAUDE_PROJECT_DIR="$d" "$d/.claude/hooks/session-start.sh"
      break
    fi
  done
  # Cache the newest Convex local backend and dashboard for `bun run dev:itun`.
  CV="$(curl -fsS --max-time 20 https://version.convex.dev/v1/local_backend_version |
    sed -n 's/.*"version": *"\([^"]*\)".*/\1/p')"
  if [ -n "$CV" ]; then
    R="https://github.com/get-convex/convex-backend/releases/download/$CV"
    C="$HOME/.cache/convex"
    T="$(mktemp -d)"
    mkdir -p "$C/binaries/$CV" "$C/dashboard"
    curl -fsSL -o "$T/b.zip" "$R/convex-local-backend-$(uname -m | sed s/arm64/aarch64/)-unknown-linux-gnu.zip" &&
      unzip -oq "$T/b.zip" -d "$C/binaries/$CV" && chmod +x "$C/binaries/$CV/convex-local-backend"
    curl -fsSL -o "$T/d.zip" "$R/dashboard.zip" && rm -rf "$C/dashboard/out" &&
      unzip -oq "$T/d.zip" -d "$C/dashboard/out" && printf '{"version":"%s"}' "$CV" >"$C/dashboard/config.json"
    rm -rf "$T"
  fi
  exit 0
  ```
- **Rules text:** attach the private `SalvageUnion-io/su-rules` repository as a
  second repository when a session or Routine needs the rulebooks. The GitHub
  proxy authenticates it, so it needs no secret and no network entry; grep its
  committed `extracted/*.txt` in the sibling checkout (no poppler).
  `check:rules-fidelity` and `check:printed-names` find it there themselves.
