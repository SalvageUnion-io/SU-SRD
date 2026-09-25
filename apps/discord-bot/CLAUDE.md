# Discord Bot

Discord bot for rolling on Salvage Union random tables. Standalone consumer of
`salvageunion-reference` — it reuses the same pure rules/data logic the apps do
([ADR-006](../../docs/adrs/ADR-006-pure-rules-logic.md)) and preloads the dataset
at startup ([ADR-005](../../docs/adrs/ADR-005-reference-data-orm.md)).

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
- `src/container.ts` - the Components V2 seam: pure `ContainerData` → `ContainerBuilder`
- `src/rollContainer.ts`, `src/lookupContainer.ts`, `src/gameContainer.ts`,
  `src/errorContainer.ts` - one container builder per surface
- `src/config.ts` - Configuration, now read only by `deploy-commands.ts`
- `src/deploy-commands.ts` - Command deployment script (run from source)

## Commands

```bash
bun run deploy-commands            # Deploy slash commands to test guild
bun run deploy-commands:global     # Deploy globally (production)
# No dev:bot and no build:bot — the gateway they drove is gone. To exercise the
# Worker locally: cd apps/discord-bot && bunx wrangler dev
```

## In The Union Now (ADR-030 Phase 6)

The bot is also an authenticated ITUN Game client. It reaches Convex through a
`/bot/*` HTTP route with a bearer credential that authenticates the **bot**,
never the **actor** — every call carries a Discord id that the server resolves
against a linked account and a real membership. See
[discord-bot-game-client.md](../../docs/architecture/discord-bot-game-client.md).

- `src/itun/` — the client (`fetch`, no `convex` dependency) and the wire types,
  which are **imported** (`import type`) from
  `apps/itun/convex/model/botWire.ts` — the same declaration `botClient.ts`
  annotates its handlers with. Never copy a shape into the bot; add it there.
  That module must stay import-free, because the bot type-checks it under
  `nodenext`.
- `src/gameEmbed.ts` — pure `data → EmbedData` builders, no discord.js, mapped
  onto a container by `src/gameContainer.ts`
- `src/commands/itunReply.ts` — the shared defer / three-mode / ephemerality spine

**Three modes, mirroring the app's.** `ITUN_CONVEX_SITE_URL` +
`ITUN_BOT_SECRET` unset ⇒ **Solo**: `/su roll` and `/su lookup`
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

**`/su sheet` is the live sheet folded into a message.** `gameEmbed.ts` maps it
one-to-one onto `EmbedData` — identity band → description, vitals rail → inline
fields, section slab → one full-width field with the slab's count in the field
*name*, `ReferenceEntityCard` → one linked line, sheet accent → accent colour,
image seat → thumbnail — and `gameContainer.ts` turns that into V2 blocks
(inline fields merge into one rail, the thumbnail pins beside the identity
band). Two consequences worth knowing before editing it:

- **Slugs are resolved, not printed.** Bodies store `classRef: 'salvager'` and
  `systems: ['armour-plating']`; the bot has the whole dataset in memory, so
  these render as the names the book prints, linked to salvageunion.io. An
  unknown slug falls back to the slug rather than vanishing — the embed must not
  disagree with the app about what a player owns.
- **Abilities group by tree**, exactly as the sheet groups them under dashed
  sub-slabs. That is faithfulness first and a field-cap fix second: a Salvager
  may take 12 abilities and 12 worst-case linked names exceed Discord's
  1024-per-field limit, which one field per tree avoids without inventing
  pagination.

**Per-sheet accents amend "colour carries one meaning".** Pilot / mech / crawler
take their `--color-sheet-*` tones from `theme.css`; `CRITICAL` still wins where
both apply. Rust remains the tone for every *non-sheet* embed.

**There are two link shapes, and picking the wrong one silently breaks the
link.** `shelfSheetUrl` builds `/sheet/<kind>/<appId>`, which resolves out of
the **clicker's own** IndexedDB — correct only for your own shelf.
`gameSheetUrl` builds `/games/<gameId>/view/<kind>/<convexId>`, the read-only
Game view, which is the only route that resolves a **crewmate's** entity.
`/su crew` and `/su sheet` both used the former and so handed every crewmate a
link that opened an empty page; neither errored.

**`/su sheet` is ephemeral, always — and that is a rule, not a default.** Most
sheets are private ([ADR-032](../../docs/adrs/ADR-032-public-read-only-sheets.md)
makes a public URL opt-in and off by default), so replying publicly would post a
build into the channel with no shareable page behind it and every link on it
404ing. The Share field appears **only** when the server reports
`publicRead: true`, and the reply stays ephemeral even then — publishing a page
is the owner's act; posting it to this channel is not the asker's to make on
their behalf. `src/__tests__/sheetVisibility.test.ts` holds both halves.

**Every reply is a Components V2 container.** With `MessageFlags.IsComponentsV2`
Discord rejects `content` and `embeds` outright, so nothing sends `embeds:`.
The `EmbedData` / `LookupEmbed` builders survive as pure, tested *content*;
the container adapters own presentation. **Limits are enforced once, in
`toContainer`** (`enforceContainerLimits`, budgets in `V2_LIMIT`) — a different
budget from `EMBED_LIMIT`, and not applied twice.

## Conventions

- Slash commands use `@discordjs/builders`' `SlashCommandBuilder`
- Everything hangs off the single `/su` top-level command (`src/commands/su.ts`)
  — subcommands, plus the `game` subcommand **group**
- Commands live in `src/commands/`, generally one file per command; the three
  small personal ones share `account.ts`
- Handlers depend on the **narrow** interaction types in
  `src/commands/interactions.ts`, never on a library's interaction classes. Add
  a member there only when a handler genuinely reads it, and update the shared
  fakes in `src/__tests__/fakeInteraction.ts` — never cast in a test
- Every message is built as `ContainerData` and rendered by `toContainer`;
  a new surface gets a `*Container.ts` builder, not an embed
- Bot token and guild IDs come from environment variables. `src/config.ts` reads
  them at module scope, so tests preload `test/env.ts` via `bunfig.toml`
