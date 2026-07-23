# Discord Bot

Discord.js bot for rolling on Salvage Union random tables. Standalone consumer of
`salvageunion-reference` — it reuses the same pure rules/data logic the apps do
([ADR-006](../../docs/adrs/ADR-006-pure-rules-logic.md)) and preloads the dataset
at startup ([ADR-005](../../docs/adrs/ADR-005-reference-data-orm.md)).

## Stack

- **Runtime:** Bun
- **Library:** Discord.js v14
- **Data:** `salvageunion-reference` workspace package (standalone, no component-lib)

## Structure

- `src/index.ts` - Bot entry point
- `src/commands/` - Slash command definitions
- `src/events/` - Event handlers
- `src/config.ts` - Bot configuration
- `src/deploy-commands.ts` - Command deployment script

## Commands

```bash
bun run dev:bot                    # Start bot locally
bun run deploy-commands            # Deploy slash commands to test guild
bun run deploy-commands:global     # Deploy globally (production)
bun run build:bot                  # Build bot
```

## Conventions

- Slash commands use Discord.js SlashCommandBuilder
- Commands live in `src/commands/` with one file per command
- Events live in `src/events/` with one file per event
- Bot token and guild IDs come from environment variables
