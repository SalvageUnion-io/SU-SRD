# Discord Bot

`/su` rolls and lookups, and a read-only Cantina Game client. An
HTTP-interactions Cloudflare Worker (`src/worker/index.ts`): no gateway, no
`start` script. Replies: [`.claude/rules/discord-bot.md`](../../.claude/rules/discord-bot.md).

- **Never add `discord.js`**, even for a type: its value import cannot run on
  workerd. Wire types and `Routes` come from `discord-api-types`, transport
  from `@discordjs/rest`, payloads are `src/commands/interactions.ts`'s.
- Data from `salvageunion-reference` (its pure rules, preloaded at startup) and
  `cantina-domain`; never `apps/web/src/components`.
- Everything hangs off `/su` (`src/commands/su.ts`), one file per command in
  `src/commands/`. Shared code reads no configuration (the Worker's `env`
  installs the client per request; only `deploy-commands.ts` reads
  `process.env`); errors go to `reportError` (`src/reportError.ts`).

```bash
bun --filter discord-bot test      # unit tests plus the signed replay harness
bun run deploy-commands            # a test guild
bun run deploy-commands:global     # production; a bot deploy runs it too. Credentials: op run
```

## The Cantina client

It calls Convex's `/bot/*` routes with a bearer that authenticates the **bot**,
never the actor: every call carries a Discord id the server resolves to a
linked account and membership ([bot as a Game client](../../docs/ARCHITECTURE.md#bot-game-client)).

- Wire types are imported (`import type`) from `cantina-domain/botWire`; never
  copy a shape into the bot.
- **It degrades:** without `CANTINA_CONVEX_SITE_URL` and `CANTINA_BOT_SECRET`,
  or with Convex down, every Game call is `unavailable` and says so as an
  outage, while `/su roll` and `/su lookup` work unchanged.
  `src/__tests__/degradedMode.test.ts` guards it.
- **It only reads:** no character editing, no `/su damage` (a Mediator never
  writes another player's sheet, ADR-030 §4).
- Crew maxima and status come from the server (`SheetResult.vitals`).
- Sheets wear `SHEET_ACCENT`, reference cards their entry's tone, rust only
  system replies. `sheetUrl` builds the one link shape, `/sheet/<kind>/<rowId>`.
