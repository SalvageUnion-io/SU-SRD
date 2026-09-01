# Salvage Union Discord Bot

A Discord bot for Salvage Union: roll on tables and look up any game entity.

## Commands

Everything lives under one namespaced top-level command, `/su` — typing `/su`
filters the Discord command picker to this bot (no collision with the many
other bots that register a bare `/roll`).

- `/su roll [table]` — Roll on a Salvage Union table. The optional `table`
  argument autocompletes across every roll table by name; omit it to roll the
  **Core Mechanic** table. The reply is an embed colored by the d20 outcome
  tier (crit → cascade failure).
- `/su lookup <entity>` — Look up any Salvage Union entity (equipment, chassis,
  systems, keywords, traits, …). The required `entity` argument autocompletes
  via full-text search; picking a suggestion (or free-typing, which falls back
  to the top search hit) replies with a rich embed whose title links out to the
  entity's page on [salvageunion.io](https://salvageunion.io)
  (`/schema/<schema>/item/<slug>`).

## Setup

### Prerequisites

- [Bun](https://bun.sh/) installed
- A Discord bot application from the [Discord Developer Portal](https://discord.com/developers/applications)

### Discord Bot Setup

1. Create a new application at https://discord.com/developers/applications
2. Go to the "Bot" section and click "Add Bot"
3. Copy the bot token
4. Go to "OAuth2" > "URL Generator"
5. Select scopes: `bot`, `applications.commands`
6. Select bot permissions: `Send Messages`, `Use Slash Commands`
7. Copy the generated URL and invite the bot to your server

### Local Development

1. Copy the environment example file:

   ```bash
   cp .env.example .env
   ```

2. Fill in your Discord credentials in `.env`:

   ```bash
   DISCORD_TOKEN=your-bot-token
   DISCORD_CLIENT_ID=your-application-id
   DISCORD_GUILD_ID=your-test-server-id  # For development
   ```

3. Install dependencies from the repo root:

   ```bash
   bun install
   ```

4. Deploy slash commands to your test server (instant, guild-scoped — needs
   `DISCORD_GUILD_ID` set):

   ```bash
   bun run deploy-commands
   ```

5. Start the bot:

   ```bash
   bun run dev:bot
   ```

### Registering slash commands

Command registration is **separate from running the bot and separate from
deploying**. Discord only needs to be told about a command's _shape_ (its name,
subcommands, and options) — so you only re-register when that shape changes
(e.g. adding a subcommand or an option). Day-to-day code changes to the handler
logic do **not** require re-registering.

- `bun run deploy-commands` — register to the test guild in `DISCORD_GUILD_ID`
  (instant; use during development).
- `bun run deploy-commands:global` — register globally for production (can take
  up to ~1 hour to propagate). Run this deliberately, only after changing the
  command shape.

Both scripts bulk-overwrite the registered set, so retired commands (e.g. the
old standalone `/roll` and `/lookup`) deregister automatically on the next run.

### Production Deployment

1. Build and start:

   ```bash
   bun run build:bot
   node apps/discord-bot/dist/index.js
   ```

2. If (and only if) the command shape changed, register globally as a separate,
   intentional step:

   ```bash
   bun run deploy-commands:global
   ```

### Render Deployment

The bot deploys to **Cloudflare Workers** ([ADR-033](../../docs/adrs/ADR-033-cloudflare-hosting.md)), from `.github/workflows/deploy-cloudflare.yml`, using `apps/discord-bot/wrangler.jsonc`. It runs as an HTTP-interactions Worker, not a gateway process.

Render is retired: the `render.yaml` blueprint that used to drive it was deleted in P8 and the service is dormant. The section below is kept only as a record of the previous deployment.

1. Connect your repository to Render
2. Render will automatically detect the blueprint
3. Set environment variables in the Render dashboard:
   - `DISCORD_TOKEN`
   - `DISCORD_CLIENT_ID`
   - `DISCORD_GUILD_ID` (optional)
   - `SENTRY_DSN` (optional — error tracking; observability is a no-op without it)

**The Render build does _not_ register slash commands.** The `buildCommand`
only installs deps and builds the bot (`bun install --ignore-scripts && bun run
build:bot`); deploying never silently re-registers global commands. When the
command shape changes, register it once, out-of-band, by running
`bun run deploy-commands:global` locally (with production `DISCORD_TOKEN` /
`DISCORD_CLIENT_ID` in your environment).

## Scripts

| Script                           | Description                       |
| -------------------------------- | --------------------------------- |
| `bun run dev:bot`                | Start the bot in development mode |
| `bun run build:bot`              | Build the bot for production      |
| `bun run deploy-commands`        | Deploy commands to test guild     |
| `bun run deploy-commands:global` | Deploy commands globally          |

## License

Salvage Union Open Game Licence 1.0b
