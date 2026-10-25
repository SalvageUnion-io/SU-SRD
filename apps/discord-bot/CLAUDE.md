# Discord Bot

`/su` rolls and lookups, and a Game client of the app. An
HTTP-interactions Cloudflare Worker (`src/worker/index.ts`): no gateway, no
`start` script. Replies: [`.claude/rules/discord-bot.md`](../../.claude/rules/discord-bot.md).

- **Never add `discord.js`**, even for a type: its value import cannot run on
  workerd. Wire types and `Routes` come from `discord-api-types`, transport
  from `@discordjs/rest`, payloads are `src/commands/interactions.ts`'s.
- Data from `salvageunion-reference` (its pure rules, preloaded at startup) and
  `game-domain`; never `apps/web/src/components`.
- Everything hangs off `/su` (`src/commands/su.ts`), one file per command in
  `src/commands/`. Shared code reads no configuration (the Worker's `env`
  installs the client per request; only `deploy-commands.ts` reads
  `process.env`); errors go to `reportError` (`src/reportError.ts`).

```bash
bun --filter discord-bot test      # unit tests plus the signed replay harness
bun run deploy-commands            # a test guild
bun run deploy-commands:global     # production; a bot deploy runs it too. Credentials: op run
```

## The Game client (`src/play/`)

It asks the site's `BotGateway` (binding `SITE`) first, then Convex's
`/bot/*` with a bearer authenticating the **bot**, never the actor: each
call carries a Discord id the server resolves to an account and membership ([bot as a Game client](../../docs/ARCHITECTURE.md#bot-game-client)).

- Wire types come from `game-domain/botWire` (`import type`); never copy one.
- **It degrades:** without `BACKEND_SITE_URL` and `BOT_SECRET`,
  or with Convex down, every Game call answers `unavailable` (an outage),
  while `/su roll` and `/su lookup` work unchanged.
  `src/__tests__/degradedMode.test.ts` guards it.
- **It reads sheets, never writes them** (no `/su damage`, ADR-030 §4). It
  writes only `channelBindings` (`src/commands/bind.ts`); Play's rolls post via
  `src/worker/relay.ts`.
- Crew maxima and status are the server's (`SheetResult.vitals`).
- Sheets wear `SHEET_ACCENT`, reference cards their entry's tone, rust only
  system replies. `sheetUrl` builds the one link shape, `/sheet/<kind>/<rowId>`.
