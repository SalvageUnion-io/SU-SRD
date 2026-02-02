# Salvage Union Discord Bot

A Discord bot for rolling on Salvage Union tables.

## Commands

- `/roll [table]` - Roll on a Salvage Union table (defaults to Core Mechanic)

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

4. Deploy slash commands to your test server:

   ```bash
   bun run deploy-commands
   ```

5. Start the bot:

   ```bash
   bun run dev:bot
   ```

### Production Deployment

1. Deploy commands globally (takes up to 1 hour to propagate):

   ```bash
   bun run deploy-commands:global
   ```

2. Build and start:

   ```bash
   bun run build:bot
   node apps/discord-bot/dist/index.js
   ```

### Render Deployment

This bot is configured to deploy to Render using the `render.yaml` blueprint at the repo root.

1. Connect your repository to Render
2. Render will automatically detect the blueprint
3. Set environment variables in the Render dashboard:
   - `DISCORD_TOKEN`
   - `DISCORD_CLIENT_ID`
   - `DISCORD_GUILD_ID` (optional)

## Scripts

| Script                           | Description                       |
| -------------------------------- | --------------------------------- |
| `bun run dev:bot`                | Start the bot in development mode |
| `bun run build:bot`              | Build the bot for production      |
| `bun run deploy-commands`        | Deploy commands to test guild     |
| `bun run deploy-commands:global` | Deploy commands globally          |

## License

Salvage Union Open Game Licence 1.0b
