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
  session that needs it. The Cloudflare and Sentry MCP hosts are left out: they
  authenticate by OAuth, which a cloud session cannot complete.
- **Setup script:** runs as root before Claude Code starts and is snapshotted
  when it ends within about five minutes, so the pinned Bun and `node_modules`
  are already in place and the SessionStart hook is a no-op. In a multi-repo
  session repo hooks do not run at all, so this script is what pins Bun there;
  its `packageManager` test picks the SU-SRD checkout out of the siblings. It
  must exit 0: a failure stops the session starting.

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
  exit 0
  ```
- **Rules text:** attach the private `SalvageUnion-io/su-rules` repository as a
  second repository when a session or Routine needs the rulebooks. The GitHub
  proxy authenticates it, so it needs no secret and no network entry; grep its
  committed `extracted/*.txt` in the sibling checkout (no poppler).
