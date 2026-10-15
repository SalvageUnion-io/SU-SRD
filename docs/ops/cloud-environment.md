# The `SU-SRD` cloud environment

The record of the claude.ai/code environment (selector → Cloud); no CLI or API edits it, so change both together.

1. **Name `SU-SRD`; one variable, `OP_SERVICE_ACCOUNT_TOKEN` (item 12).**
2. **Network: Custom, "Also include default list of common package managers" ticked.** Keeps GitHub releases, npm and PyPI (Bun, audit, workflow lint, Convex).
3. **Extra allowed hosts.** `mcp.context7.com`, `version.convex.dev` (`bun run dev:cantina`), `salvageunion.io`, `www.salvageunion.io`, `assets.salvageunion.io`, `intheunionnow.com`, `www.intheunionnow.com`,
   `su-srd.alxjrvs.workers.dev`, `su-discord-bot.alxjrvs.workers.dev`, `cdn.playwright.dev`, `playwright.download.prss.microsoft.com`,
   `cache.agilebits.com`, `my.1password.com`, `discord.com`, `*.r2.cloudflarestorage.com`.
4. **No Cloudflare MCP hosts.** OAuth fails in the cloud; the connectors below stand in.
5. **Connectors (claude.ai → Settings → Connectors).** Cloudflare Developer Platform and custom Cloudflare Observability
   at `https://observability.mcp.cloudflare.com/mcp`.
6. **Convex.** The SessionStart hook exports `CONVEX_AGENT_MODE=anonymous`, so `bun run dev:cantina` runs a local backend with no account.
   Test-auth setup: [`convex-ops`](../../.claude/skills/convex-ops/SKILL.md#local-backend), per container.
7. **First `dev:cantina` in a fresh container.** Copy `apps/web/.env.example` to `.env.local` first (else the CLI writes `CONVEX_URL`, not `VITE_CONVEX_URL`);
   the first run exits at Vite, so run it again.
8. **Playwright.** The image's Chromium is older than `@playwright/test`'s: run e2e specs with `executablePath: '/opt/pw-browsers/chromium'`, never `playwright install`.
9. **Setup script.** Paste the script below; it runs as root, must exit 0, and is snapshotted, so the hook is a no-op at start.
   It also caches the Convex local backend and dashboard (its CLI download fails via the proxy).
10. **Rules text.** Attach private `SalvageUnion-io/su-rules` as a second repo; `bun run rules:find` reads it.
    `bun run check:rules-fidelity` finds the sibling checkout itself.
11. **Multi-repo.** The project dir is `/home/user`, so the script copies `.claude/settings.json` there.
12. **1Password.** The token reads the whole `SUSRD` vault; the hook adds `op`.

```bash
#!/bin/bash
# SU-SRD: docs/ops/cloud-environment.md is this script's record.
# Item 9: warm the snapshot with the repo's SessionStart hook.
for d in "${CLAUDE_PROJECT_DIR:-}" "$PWD" /home/user/* /root/* /workspace/*; do
  if [ -x "$d/.claude/hooks/session-start.sh" ] &&
    grep -q '"packageManager": *"bun@' "$d/package.json" 2>/dev/null; then
    CLAUDE_PROJECT_DIR="$d" "$d/.claude/hooks/session-start.sh"
    [ "$d" = /home/user ] || { mkdir -p /home/user/.claude && sed -e "s|\$CLAUDE_PROJECT_DIR|$d|g" \
      -e "s|\"command\": \"|&cd $d \&\& CLAUDE_PROJECT_DIR=$d |" "$d/.claude/settings.json" >/home/user/.claude/settings.json; } # 11
    break
  fi
done
# Item 9: cache the newest Convex local backend and dashboard.
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
