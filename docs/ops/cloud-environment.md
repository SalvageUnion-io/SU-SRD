# The `SU-SRD` cloud environment

The record of the claude.ai/code environment (selector → Cloud); no CLI or API edits it, so change both together.

1. **Name `SU-SRD`, no environment variables.** Never put a secret here.
2. **Network: Custom, "Also include default list of common package managers" ticked.** Keeps GitHub releases, npm and PyPI (the Bun pin, `bun run audit`, `tools/lint-workflows.sh`, the Convex backend).
3. **Extra allowed hosts.** `mcp.context7.com`, `version.convex.dev` (`bun run dev:itun`), `salvageunion.io`, `www.salvageunion.io`, `assets.salvageunion.io`, `intheunionnow.com`, `www.intheunionnow.com`,
   `su-srd.alxjrvs.workers.dev`, `su-discord-bot.alxjrvs.workers.dev`, `cdn.playwright.dev`, `playwright.download.prss.microsoft.com`.
4. **No Cloudflare or Sentry MCP hosts.** Their OAuth cannot complete in a cloud session; the claude.ai connectors below stand in.
5. **Connectors (claude.ai → Settings → Connectors).** Cloudflare Developer Platform, Sentry (org `susrd`), and custom Cloudflare Observability
   at `https://observability.mcp.cloudflare.com/mcp`.
6. **Convex.** The SessionStart hook exports `CONVEX_AGENT_MODE=anonymous`, so `bun run dev:itun` runs a local backend with no account;
   in a multi-repo session (no repo hooks) prefix it yourself. Test-auth setup: [`convex-ops`](../../.claude/skills/convex-ops/SKILL.md#local-backend), per container.
7. **First `dev:itun` in a fresh container.** Copy `apps/itun/.env.example` to `.env.local` first (else the CLI writes `CONVEX_URL`, not `VITE_CONVEX_URL`);
   the first run exits at Vite, so run it again.
8. **Playwright.** The image's Chromium is older than `@playwright/test`'s: run e2e specs with `executablePath: '/opt/pw-browsers/chromium'`, never `playwright install`.
9. **Setup script.** Paste the script below; it runs as root, must exit 0, and is snapshotted, so the hook is a no-op at start.
   It also caches the newest Convex local backend and dashboard in `~/.cache/convex` (the CLI's own download crashed through the proxy).
10. **Rules text.** Attach private `SalvageUnion-io/su-rules` as a second repo (no secret or host needed); grep its `extracted/*.txt`.
    `bun run check:rules-fidelity` finds the sibling checkout itself.

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
