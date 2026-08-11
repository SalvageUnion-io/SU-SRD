# Discord Bot

Discord.js bot for rolling on Salvage Union random tables. Standalone consumer of
`salvageunion-reference` — it reuses the same pure rules/data logic the apps do
([ADR-006](../../docs/adrs/ADR-006-pure-rules-logic.md)) and preloads the dataset
at startup ([ADR-005](../../docs/adrs/ADR-005-reference-data-orm.md)).

## Stack

- **Runtime:** Bun
- **Library:** Discord.js v14
- **Data:** `salvageunion-reference` workspace package (standalone, no component-lib)

## Sourcemaps are half of Sentry here

`build` bundles with `--sourcemap=linked` and `start` runs
`node --enable-source-maps`. **Both halves are required and neither is a debug
nicety.** The bot ships a 2 MB bundle, so without them every Sentry issue points
at an offset in `dist/index.js` and names no real file; with them Node maps the
frames in-process *before* `@sentry/node` builds the event, which is also why the
bot needs no sourcemap upload step. Verified: `dist/index.js:58721` resolves to
`src/config.ts:4:11`. `render.yaml`'s `startCommand` carries the runtime half and
the full reasoning — change the two together or not at all.

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

## In The Union Now (ADR-030 Phase 6)

The bot is also an authenticated ITUN Game client. It reaches Convex through a
`/bot/*` HTTP route with a bearer credential that authenticates the **bot**,
never the **actor** — every call carries a Discord id that the server resolves
against a linked account and a real membership. See
[discord-bot-game-client.md](../../docs/architecture/discord-bot-game-client.md).

- `src/itun/` — the client (`fetch`, no `convex` dependency) and the wire types
- `src/gameEmbed.ts` — pure `data → EmbedData` builders, no discord.js
- `src/commands/itunReply.ts` — the shared defer / three-mode / ephemerality spine

**Three modes, mirroring the app's.** `ITUN_CONVEX_SITE_URL` +
`ITUN_BOT_SECRET` unset ⇒ **Solo**: `/su roll`, `/su check` and `/su lookup`
behave exactly as they did before accounts existed, and the Game commands say
they are not connected. Configured but unreachable ⇒ **Degraded**, worded as an
outage rather than a permissions problem. `src/__tests__/soloMode.test.ts` is
the guard; **do not let it regress** — the reference bot is what people use.

**The bot reads widely and writes narrowly.** It writes only through mutations
that already exist, and only facts already modelled on the Change Log. No
character editing, and no `/su damage` — a Mediator writing another player's
sheet is forbidden on every surface (ADR-030 §4); it becomes a proposal or it
does not exist.

**Maxima are derived here, not fetched.** Convex stores entity bodies opaquely
and cannot compute max HP/SP/Heat, so `gameEmbed.ts` derives them via
`salvageunion-reference/rules` ([ADR-006](../../docs/adrs/ADR-006-pure-rules-logic.md)).

## Conventions

- Slash commands use Discord.js SlashCommandBuilder
- Everything hangs off the single `/su` top-level command (`src/commands/su.ts`)
  — subcommands, plus the `game` subcommand **group**
- Commands live in `src/commands/`, generally one file per command; the three
  small personal ones share `account.ts`
- Handlers depend on the **narrow** interaction types in
  `src/commands/interactions.ts`, never on discord.js's interaction classes. Add
  a member there only when a handler genuinely reads it, and update the shared
  fakes in `src/__tests__/fakeInteraction.ts` — never cast in a test
- Events live in `src/events/` with one file per event
- Bot token and guild IDs come from environment variables. `src/config.ts` reads
  them at module scope, so tests preload `test/env.ts` via `bunfig.toml`
