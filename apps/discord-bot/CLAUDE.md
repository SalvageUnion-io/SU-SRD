# Discord Bot

The Discord bot: `/su` rolls and lookups, and an In the Union now Game client. A consumer of
`salvageunion-reference` — it reuses the same pure rules/data logic the apps do
([ADR-006](../../docs/ARCHITECTURE.md#decisions)) and preloads the dataset
at startup ([ADR-005](../../docs/ARCHITECTURE.md#decisions)).

## Stack

- **Runtime:** Bun
- **Library:** `@discordjs/builders` (commands + Components V2),
  `@discordjs/rest`, `discord-api-types`. **Not `discord.js`** — nothing here
  needs its gateway client.
- **Data:** `salvageunion-reference` workspace package. From `component-lib` it
  imports only the dependency-free `component-lib/product` subpath (the product's
  names), never the barrel.

## Runtime

The bot is an **HTTP-interactions Cloudflare Worker** (`src/worker/index.ts`,
deployed by `wrangler.jsonc`). There is no Node gateway and no `start` script;
`build` is typecheck plus a `wrangler` dry-run bundle. The Worker reports to
Sentry through `observability/cloudflare`. Wire types and `Routes` come from
`discord-api-types`; the Worker and `deploy-commands.ts` talk to Discord through
`@discordjs/rest`; reply payloads are the local `ReplyPayload` /
`EditReplyPayload` in `src/commands/interactions.ts`. Never add `discord.js`,
even for a type: its value import cannot run on workerd.

## Structure

- `src/worker/` - THE entry point (`index.ts`), request verification, and the
  adapter from raw interactions to the narrow types in `src/commands/interactions.ts`
- `src/commands/` - Slash command definitions and handlers
- `src/buttons.ts` + `src/customId.ts` - stateless button routing (`su:<action>:<payload>`)
- `src/container.ts` - the Components V2 seam: pure `ContainerData` → `ContainerBuilder`,
  and `entityCard()`, the one render for sheets and Game cards
- `src/lookupCard.ts` - the `/su lookup` card: the shared Discord card
  (`discordCardParts` in `salvageunion-reference`, also the SRD's Component
  Embed) plus tabs, pages, the pattern picker and roll buttons
- `src/gameCards.ts` - Game cards (`data → entityCard`)
- `src/termFinder.ts`, `src/commands/lookUpMessage.ts` - "Look up in Salvage
  Union", the message context menu
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

**The bot reads widely and writes narrowly.** It writes only through mutations
that already exist, and only facts already modelled on the Change Log. No
character editing, and no `/su damage` — a Mediator writing another player's
sheet is forbidden on every surface (ADR-030 §4); it becomes a proposal or it
does not exist.

**Maxima are derived here, not fetched.** `gameCards.ts` derives max
HP/SP/Heat via `salvageunion-reference/rules`
([ADR-006](../../docs/ARCHITECTURE.md#decisions)). Convex's `crew.vitals`
derives the same maxima with the same rules; the two must agree.

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
both apply. A reference card wears its entry's tone (`discordAccent`); rust
stays only for system replies (errors, invites).

**One link shape, one live sheet.** `sheetUrl` builds `/sheet/<kind>/<rowId>`
from the Convex row id for every sheet the bot links — `/su my-stuff`, `/su crew`
and `/su sheet`. ITUN's `entities.locate` resolves it: yours editable, a
crewmate's read-only.

## Conventions

- Everything hangs off the single `/su` top-level command (`src/commands/su.ts`)
  — subcommands, plus the `game` subcommand **group**
- Commands live in `src/commands/`, generally one file per command; the three
  small personal ones share `account.ts`
- Shared code reads no configuration. The Worker's `env` installs the ITUN
  client per request; `deploy-commands.ts` alone reads `process.env`
- Errors in shared code go straight to `reportError` from `observability/cloudflare`
