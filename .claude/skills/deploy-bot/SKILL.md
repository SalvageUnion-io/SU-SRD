---
name: deploy-bot
description: Deploy Discord bot slash commands (test guild or global)
argument-hint: '[global]'
allowed-tools: Bash
---

# Deploy Bot Commands

Deploy Discord bot slash commands.

If `$ARGUMENTS` contains "global":

1. Run `bun run deploy-commands:global` to deploy globally (production)
2. Warn that global commands can take up to 1 hour to propagate

Otherwise:

1. Run `bun run deploy-commands` to deploy to test guild only
2. Test guild commands update instantly
