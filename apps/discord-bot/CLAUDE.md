# Discord Bot

The Discord bot: `/su` rolls and lookups, and an In the Union now Game client. A consumer of
`salvageunion-reference` — it reuses the same pure rules/data logic the apps do
([ADR-006](../../docs/ARCHITECTURE.md#decisions)) and preloads the dataset
at startup ([ADR-005](../../docs/ARCHITECTURE.md#decisions)).

## Stack

- **Runtime:** a Cloudflare Worker (workerd); Bun runs the tooling and tests
- **Library:** `@discordjs/builders` (commands + Components V2),
  `@discordjs/rest`, `discord-api-types`.
- **Data:** `salvageunion-reference` workspace package. From `component-lib` it
  imports only the dependency-free `component-lib/product` subpath (the product's
  names), never the barrel.

## Runtime

The bot is an **HTTP-interactions Cloudflare Worker** (`src/worker/index.ts`,
deployed by `wrangler.jsonc`). There is no Node gateway and no `start` script;
`build` is typecheck plus a `wrangler` dry-run bundle. The Worker reports to
Workers Issues through `observability/cloudflare`. Wire types and `Routes` come from
`discord-api-types`; the Worker and `deploy-commands.ts` talk to Discord through
`@discordjs/rest`; reply payloads are the local `ReplyPayload` /
`EditReplyPayload` in `src/commands/interactions.ts`. Never add `discord.js`
(the gateway client nothing here needs), even for a type: its value import
cannot run on workerd.

## Structure

`src/container.ts` is the one Components V2 seam (see `.claude/rules/discord-bot.md`);
`src/termFinder.ts` + `src/commands/lookUpMessage.ts` are the "Look up in Salvage Union" message context menu.

## Commands

```bash
bun --filter discord-bot test      # the loop: unit tests plus the signed replay harness
bun run deploy-commands            # a test guild
bun run deploy-commands:global     # production; a bot deploy runs it too. Credentials: op run
```

## In the Union now

The bot is also an authenticated ITUN Game client. It reaches Convex through a
`/bot/*` HTTP route with a bearer credential that authenticates the **bot**,
never the **actor** — every call carries a Discord id that the server resolves
against a linked account and a real membership. See
[the bot as a Game client](../../docs/ARCHITECTURE.md#bot-game-client).

- `src/itun/` — the client (`fetch`, no `convex` dependency) and the wire types,
  which are **imported** (`import type`) from `itun-domain/botWire`
  (`packages/itun-domain/src/botWire.ts`) — the same declaration `botClient.ts`
  annotates its handlers with. Never copy a shape into the bot; add it there.
  That module must stay import-free, so the bot's type-check never pulls in
  Convex's generated model.
- `src/commands/itunReply.ts` — the shared defer / result-kind / ephemerality
  spine, and the one client (`itun()`, installed per request from `env`)

**One client that degrades.** `ITUN_CONVEX_SITE_URL` and `ITUN_BOT_SECRET` are
both required (`wrangler.jsonc`'s `secrets.required`; `/health` answers 503
while either is missing). When the deployment is down, unreachable or
unconfigured, every call is `unavailable` and the Game commands say so as an
outage rather than a permissions problem, while `/su roll` and `/su lookup`
behave exactly the same. `src/__tests__/degradedMode.test.ts` is the guard;
**do not let it regress** — the reference bot is what people use.

**The bot only reads.** No character editing, and no `/su damage` — a Mediator
writing another player's sheet is forbidden on every surface (ADR-030 §4); it
becomes a proposal or it does not exist.

**Crew maxima and status come from the server** (`SheetResult.vitals`, the
`crew.vitals` derivation); absent, a vital shows its current value alone.

**ITUN commands:** `/su me`, `games`, `sheet`. `sheet` takes your own entity
or any sheet link; `botClient.sheet` decides what you may read.

**`/su sheet`** maps the live sheet one-to-one onto an entity card. The mapping,
slug resolution and ability grouping are documented on `sheetCard`, `refLink`
and `abilityFields` in `gameCards.ts`.

**Accent colour:** sheets wear `SHEET_ACCENT` (see its comment; `CRITICAL`
wins), reference cards wear their entry's tone (`discordAccent`), and rust is
only for system replies (errors).

**One link shape.** `sheetUrl` builds `/sheet/<kind>/<rowId>`; ITUN's
`entities.locate` opens it editable for its owner, read-only otherwise.

## Conventions

- Everything hangs off the single `/su` top-level command (`src/commands/su.ts`)
- Commands live in `src/commands/`, generally one file per command; the two
  small personal ones share `account.ts`
- Shared code reads no configuration. The Worker's `env` installs the ITUN
  client per request; `deploy-commands.ts` alone reads `process.env`
- Errors in shared code go straight to `reportError` from `observability/cloudflare`
