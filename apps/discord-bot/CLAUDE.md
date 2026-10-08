# Discord Bot

Discord bot for rolling on Salvage Union random tables. Standalone consumer of
`salvageunion-reference` — it reuses the same pure rules/data logic the apps do
([ADR-006](../../docs/ARCHITECTURE.md#adr-006)) and preloads the dataset
at startup ([ADR-005](../../docs/ARCHITECTURE.md#adr-005)).

## Stack

- **Runtime:** Bun
- **Library:** `@discordjs/builders` (commands + Components V2),
  `@discordjs/rest`, `discord-api-types`. **Not `discord.js`** — it was dropped
  in the 2026-09-25 audit (AP-14); nothing here needs its gateway client.
- **Data:** `salvageunion-reference` workspace package (standalone, no component-lib)

## Runtime

The bot is an **HTTP-interactions Cloudflare Worker** (`src/http/worker.ts`,
deployed by `wrangler.jsonc`). There is no Node gateway, no `dist/` bundle and
no `build`/`start` script; the Worker reports to Sentry through
`observability/cloudflare`. There is no `discord.js` dependency: slash commands
and replies are built with `@discordjs/builders`, the wire types and `Routes`
come from `discord-api-types`, and both the Worker and `deploy-commands.ts`
talk to Discord through `@discordjs/rest`. Reply payloads are the local
`ReplyPayload` / `EditReplyPayload` in `src/commands/interactions.ts`, not
`discord.js`'s options classes. Do not re-add `discord.js` for a type — its
value import cannot run on workerd, and the portable packages cover everything
the bot uses.

## Structure

- `src/http/` - THE entry point (`worker.ts`), request verification, and the
  adapter from raw interactions to the narrow types in `src/commands/interactions.ts`
- `src/commands/` - Slash command definitions and handlers
- `src/buttons.ts` + `src/customId.ts` - stateless button routing (`su:<action>:<payload>`)
- `src/container.ts` - the Components V2 seam: pure `ContainerData` → `ContainerBuilder`,
  and `entityCard()`, the one render for every entity surface
- `src/lookupCard.ts`, `src/gameCards.ts` - entity cards (`data → entityCard`)
- `src/rollContainer.ts`, `src/errorContainer.ts`, `src/inviteContainer.ts` -
  surfaces that author their own blocks
- `src/deploy-commands.ts` - Command registration CLI (run from source); the
  only file that reads `process.env`

## Commands

```bash
bun --filter discord-bot test      # the loop: unit tests plus the signed replay harness
bun run deploy-commands            # Register slash commands to a test guild
bun run deploy-commands:global     # Register globally (production)
```

There is no local Worker loop: the Interactions Endpoint URL is
application-wide, so Discord only ever reaches the deployed Worker.
`src/http/__tests__/replay.test.ts` drives the Worker with signed,
Discord-shaped payloads instead.

## In The Union Now (ADR-030 Phase 6)

The bot is also an authenticated ITUN Game client. It reaches Convex through a
`/bot/*` HTTP route with a bearer credential that authenticates the **bot**,
never the **actor** — every call carries a Discord id that the server resolves
against a linked account and a real membership. See
[the bot as a Game client](../../docs/ARCHITECTURE.md#discord-bot-as-a-game-client).

- `src/itun/` — the client (`fetch`, no `convex` dependency) and the wire types,
  which are **imported** (`import type`) from
  `apps/itun/convex/model/botWire.ts` — the same declaration `botClient.ts`
  annotates its handlers with. Never copy a shape into the bot; add it there.
  That module must stay import-free, because the bot type-checks it under
  `nodenext`.
- `src/gameCards.ts` — pure `data → ContainerData` card builders through
  `entityCard()`
- `src/commands/itunReply.ts` — the shared defer / result-kind / ephemerality
  spine, and the one client (`itun()`, installed per request from `env`)

**One client that degrades.** `ITUN_CONVEX_SITE_URL` and `ITUN_BOT_SECRET` are
both required (`wrangler.jsonc`'s `secrets.required`; `/health` answers 503
while either is missing). When the deployment is down, unreachable or
unconfigured, every call is `unavailable` and the Game commands say so as an
outage rather than a permissions problem, while `/su roll` and `/su lookup`
behave exactly the same. `src/__tests__/degradedMode.test.ts` is the guard;
**do not let it regress** — the reference bot is what people use.

**The bot reads widely and writes narrowly.** It writes only through mutations
that already exist, and only facts already modelled on the Change Log. No
character editing, and no `/su damage` — a Mediator writing another player's
sheet is forbidden on every surface (ADR-030 §4); it becomes a proposal or it
does not exist.

**Maxima are derived here, not fetched.** `gameCards.ts` derives max
HP/SP/Heat via `salvageunion-reference/rules`
([ADR-006](../../docs/ARCHITECTURE.md#adr-006)). Convex's `crew.vitals` now
derives them too, with the same rules; moving the bot onto those is #1068.

**`/su sheet` is the live sheet folded into a message.** `gameCards.ts` maps it
one-to-one onto an entity card — identity band → description, vitals rail →
inline fields, section slab → one full-width field with the slab's count in the
field *name*, `ReferenceEntityCard` → one linked line, sheet accent → accent
colour, image seat → thumbnail — and `entityCard()` turns that into V2 blocks
(inline fields merge into one rail, the thumbnail pins beside the identity
band). Two consequences worth knowing before editing it:

- **Slugs are resolved, not printed.** Bodies store `classRef: 'salvager'` and
  `systems: ['armour-plating']`; the bot has the whole dataset in memory, so
  these render as the names the book prints, linked to salvageunion.io. An
  unknown slug falls back to the slug rather than vanishing — the card must not
  disagree with the app about what a player owns.
- **Abilities group by tree**, exactly as the sheet groups them under dashed
  sub-slabs, one slab per tree.

**Per-sheet accents amend "colour carries one meaning".** Pilot / mech / crawler
take their `--color-sheet-*` tones from `theme.css`; `CRITICAL` still wins where
both apply. Rust remains the tone for every *non-sheet* reply.

**Two link shapes, one live sheet.** `shelfSheetUrl` builds
`/sheet/<kind>/<appId>`; `gameSheetUrl` builds `/games/<gameId>/view/<kind>/<id>`,
which redirects there. Either opens the live sheet — yours editable, a
crewmate's read-only (ITUN's `entities.locate`). `/su crew` and `/su sheet` keep
`gameSheetUrl`: it names the Game the row came from.

## Conventions

- Slash commands use `@discordjs/builders`' `SlashCommandBuilder`
- Everything hangs off the single `/su` top-level command (`src/commands/su.ts`)
  — subcommands, plus the `game` subcommand **group**
- Commands live in `src/commands/`, generally one file per command; the three
  small personal ones share `account.ts`
- Shared code reads no configuration. The Worker's `env` installs the ITUN
  client per request; `deploy-commands.ts` alone reads `process.env`
- Errors in shared code go straight to `reportError` from `observability/cloudflare`
