# Architecture

The cross-cutting architecture of the SURef monorepo, one section per area:
what is true now, pointing at the source for anything that changes fast.
History is in git; the decisions behind it close the file as
[Decisions](#decisions), one `## ADR-NNN` each (`grep -n '^## ADR-'`).

**Reading it:** Read ignores `#anchors`. Run `grep -n '^##' docs/ARCHITECTURE.md`,
then Read with an offset and limit for the section you need; never Read the
whole file.

Three docs stay separate: [architecture/dashboard.md](architecture/dashboard.md)
(the Dashboard as built; [ADR-038](#adr-038) is its one decision record),
[design-system/ruleset.md](design-system/ruleset.md) (the design laws, cited by
section number) and [design-system/tailwind-removal.md](design-system/tailwind-removal.md)
(the live Tailwind-removal plan).

**Sections:** [Packages and contracts](#packages-and-contracts) ·
[Data flow](#data-flow) · [Accounts and Games operations](#accounts-and-games-operations) ·
[Rules and ITUN surfaces](#rules-and-itun-surfaces) · [Combat loop](#combat-loop) ·
[Display system](#display-system) · [Component catalog](#component-catalog) ·
[Discord bot as a Game client](#discord-bot-as-a-game-client) ·
[SEO and accessibility](#seo-and-accessibility) · [CI and deploy](#ci-and-deploy) ·
[Dependencies](#dependencies) · [Services and agent tooling](#services-and-agent-tooling) ·
[Decisions](#decisions)

## Packages and contracts

The dependency graph is in [`CLAUDE.md`](../CLAUDE.md), whose "Build &
Validation" is the cross-package checklist; workspace dependencies use
`workspace:*`. The new-schema registry list is in
[`packages/salvageunion-reference/CLAUDE.md`](../packages/salvageunion-reference/CLAUDE.md).
Two items stated nowhere else:

- Adding a component-lib peer dependency: add it to both `peerDependencies` and
  `devDependencies`.
- Adding or removing a component-lib export: update the `src/index.ts` barrel.

### salvageunion-reference

Private, never published. The dataset's public interface is srd's CORS-enabled
JSON API: `apps/srd/src/endpoints/schemaJson.ts`, `schemaDefinitionJson.ts`,
`itemJson.ts` (plus `searchIndexJson.ts`, `llmsTxt.ts`), registered in
`apps/srd/ssg/endpoints.ts`, documented at `apps/srd/src/pages/api.page.tsx`
([ADR-014](#adr-014), [ADR-040](#adr-040)). The package has no version or
release stream.

- **Entry points** `.`, `./rules`, `./zod`,
  `./testing`, each `types` and `default` on one `lib/*.ts` source (the
  `exports` map in `packages/salvageunion-reference/package.json`); no build.
  `./rules` is the pure rules math ([ADR-006](#adr-006)).
  `./zod` is the one Zod import ([ADR-013](#adr-013)).
  `./testing` is test-only: `entityFixture(schema, fields)` and
  `malformed<T>(value)`, never `as unknown as SURef*`. `./data/*` and
  `./schemas/*` are the committed JSON files, which srd's
  `/schema/[id].json` and `/schema/[id].schema.json` serve verbatim
  (`apps/srd/src/lib/referenceFiles.ts`); each schema's `$id` is the URL it is
  served at.
- **The barrel is an explicit list.** `lib/index.ts` and `lib/rules/index.ts`
  name each export that has an outside consumer; no `export *`, no Zod schemas.
  `lib/index.ts` is the API's source of truth: 27 model accessors, `.get` /
  `.exists` / `.getMany` / `.findIn` / `.findAllIn`, `.parseRef` / `.getByRef`,
  `.search` / `.searchIn` / `.getSuggestions`, `getTechLevel` /
  `getSalvageValue` (`lib/entityFields.ts`), every `SURef*` type (generated
  into `lib/generated/entityTypes.generated.ts` from `lib/schemas/registry.ts`)
  and utilities such as `rollOnTable` and `resolveChoiceView`.
- **Runtime deps** `zod`, `jsonc-parser`; none for dev. `schemas/*.schema.json`
  is generated from `lib/schemas/`: edit those, then `bun run build:package`.
- **Lazy loading.** One stable `LazyModel<T>` per schema;
  `preload('all' | ids[])` dynamic-imports in parallel and installs the backing
  model (`_install()`); idempotent; `isLoaded(id)`. Access before load, or an
  id not in `dataLoaders` (`lib/generated/modelFactoryRegistry.generated.ts`),
  throws. Convex has no dynamic `import()`, so it `install()`s imported files
  instead. Loads are trusted: CI
  validates every file and `lib/dataCanonical.test.ts` proves the parse is the
  identity, so no runtime module imports Zod (`lib/loadPathBundle.test.ts`).
- **Reference strings** are `"schemaId::entityId"` (ids are UUIDs except
  `catalog-categories`). `parseRef()` returns `null` when malformed, `getByRef()`
  `undefined` when unresolvable. New data uses this format, never a bare id.

### Module-scope ORM calls

A `SalvageUnionReference` accessor at module scope runs before `preload()` and
throws at import; call it in a function, hook or effect. Enforced by
`tools/biome/noModuleScopeReferenceCall.grit`.

### One-way dependencies

Neither the reference package nor component-lib imports from an app;
app-specific logic belongs in the app. Enforced by `noRestrictedImports` in
[`biome.jsonc`](../biome.jsonc).

### Test preload setup

A workspace whose tests touch `SalvageUnionReference` lists the shared
`test/reference-preload.ts` (`../../test/reference-preload.ts`) in its
`bunfig.toml` `[test] preload`, so no test file calls `preload('all')` itself.

### component-lib

TypeScript source, no build ([ADR-011](#adr-011)).
Exports `.` (`src/index.ts`, the source of truth; never trust a count),
`./design/tokens`, `./styles/index.css`, `./styles/tailwind.css`,
`./styles/theme.css`. `src/styles/theme.css` is the one token set;
`src/design/tokens.ts` mirrors it as a zero-import leaf for consumers with no
stylesheet; never copy a token literal (`tokens.parity.test.ts`). The library
owns the design system: primitives (the Atoms, Containers and Foundations of
its catalog) and the entity display system, whether one app renders them or
two. A composition only one app renders, and its styles, live in that app
(`apps/itun/src/components/`, `apps/srd/src/components/`, the Dashboard's
`.pc-*` rules in `apps/itun/src/styles/dashboard/`) until a second app renders
it. `bun run check barrel-consumers` enforces both halves: it fails an export
no app imports, and a single-app export whose story files it under
`Compositions/`. Internal on purpose: no `Tooltip`; `EntityTooltip` and `ConditionChip` are
sub-parts. Customise through generic slot props and hooks that return them.

### component-lib dependencies

- Peers: `react`, `react-dom` only. Dependencies: `@base-ui/react`,
  `salvageunion-reference`, `lucide-react`, `sonner`,
  `class-variance-authority`, `clsx`, `tailwind-merge`
  ([declare what you import](#declare-what-you-import)).
- Stylesheets are exports, never side-effect imports (`bun run check styling`,
  `srd-css`).
- **`"sideEffects": ["**/*.css"]`:** bundlers drop any module whose exports go
  unused. A module that must run at import is added to that list, or
  production tree-shakes it away.

### srd build surface

In-house SSG over Vite and React islands; contract
[`apps/srd/ssg/DESIGN.md`](../apps/srd/ssg/DESIGN.md). Routes
`src/pages/**/*.page.tsx` in `ssg/routes.ts`, endpoints `src/endpoints/*.ts` in
`ssg/endpoints.ts`; nothing is discovered. `bun ssg/build.ts` and
`bun ssg/dev.ts` share `ssg/render.tsx`. **No `.css` import may be reachable
from an SSR module:** css comes from `src/runtime/styles.entry.ts`, assets from
`src/runtime/assets.entry.ts` via `RouteContext.builtAssets`. No auth,
persistence, router or Zustand.

### itun consumes

The reference package, component-lib, `idb` (`src/lib/db/`),
`@tanstack/react-router`, `zustand` (`src/stores/`), `@base-ui/react`, and
Convex (`apps/itun/convex/`).

### Tailwind source paths

One entry, `packages/component-lib/src/styles/tailwind.css`, imports Tailwind,
`theme.css` and `index.css` (into `layer(su-base)`) and scans the library
(`@source '..'`, stories and tests excluded). `@source` resolves relative to
the file that declares it, so the scan is the same for every consumer:

```css
/* apps/itun/src/index.css, apps/srd/src/styles/global.css */
@import 'component-lib/styles/tailwind.css';
@source not './**/*.stories.tsx'; /* each app's own stories (srd: '../**') */
```

### discord-bot

`@discordjs/builders`, `@discordjs/rest`, `discord-api-types`: HTTP
interactions, no gateway, no `discord.js`. Consumes the reference package and
`observability` (`withObservability` / `reportError`). It imports `apps/itun/convex/model/botWire.ts` as a type
only (from `src/itun/types.ts`): the wire contract, so a change to it is
cross-package (typecheck the bot), and it stays import-free.

## Data flow

Player records store **slug references** (`class_ref: 'hybrid-wolf'`), never
copies of game data, resolved against `SalvageUnionReference` at render. ITUN
preloads the dataset once in `src/components/shared/GameDataReady.tsx`.

Three connection modes ([ADR-030](#adr-030),
[ADR-034](#adr-034)):

| Mode | Who | Truth | Reads | Writes |
| --- | --- | --- | --- | --- |
| **Solo** | not signed in | nothing | nothing of theirs | **refused** — sign in to build |
| **Connected** | signed in, online | Convex | reactive subscription | to Convex |
| **Disconnected** | signed in, offline | Convex | local cache | **blocked** |

Solo is read-only: building needs an account (ADR-034 decision 1, as
amended), so the Roster and the `/…/new` routes show a sign-in panel and the
store refuses an anonymous write. Solo has
no Dashboard: it opens only for a pilot in a Game with a Mediator
([ADR-038](#adr-038)), so Solo play is on the live sheet. Offline,
a signed-in user is read-only and never falls back to IndexedDB, which would
fork data against the server of record. The mode comes from
`resolveConnectionMode()` (`apps/itun/src/lib/connection/connectionMode.ts`),
never `navigator.onLine` or an auth flag.

### IndexedDB cache

`apps/itun/src/lib/db/` via `idb` ([ADR-002](#adr-002)):
database `itun-v1`, `DB_VERSION = 19` (`src/lib/db/index.ts`), stores in
`src/lib/db/stores.ts`: `pilots`, `mechs`, `crawlers`, `mechPatterns`
(immutable builds), `encounterNpcs`, `softLinks` and `meta`.

- **One account's cache.** `meta` holds one row, `{ userId }`
  (`src/lib/db/cacheMeta.ts`): the account whose rows these are. Sign-out
  empties the cache (`clearCache`). So does a signed-in boot whose `userId`
  differs (`src/lib/account/cacheOwner.ts`). Nothing in the cache is ever sent
  up.
- `ShelfSync` adopts a `listMine` row when its `updatedAt` is newer than the
  version this browser last saw (`planRowSync`). A pilot or mech write sends
  that version back, and `upsertByAppId` refuses it as stale when the row has
  moved on.

- `makeStore(getDb, schema, storeName, opts)` (`src/lib/db/crud.ts`) parses
  with Zod on write and strictly on read: an unreadable record is skipped with
  a warning and refilled from Convex. Pilot, Mech, Crawler stamp
  `updatedAt`; SoftLink and MechPattern only `createdAt`.
- An upgrade (`openDB`'s `upgrade`) rewrites no record: it deletes every store
  an older version created and creates the current set empty, and `ShelfSync`
  and `WiringSync` refill them from Convex on the next signed-in load. A schema
  change bumps `DB_VERSION` and nothing else.
- `atomicWrite()` writes several records in one transaction; a delete with
  `pruneSoftLinks` removes the entity's links with it.

### Convex, the server of record

`apps/itun/convex/` and `apps/itun/src/lib/connection/`; permissions in
`convex/model/permissions.ts`. `convex/schema.ts` holds the auth tables, an
extended `users` row, `games`, `memberships`, invites, proposals, downtime and
the entity rows.

- **Two containers:** an entity is in a `games` row or on its owner's Shelf
  (`gameId` null). A null `ownerId` is unclaimed, a normal state; null
  `gameId` with null `ownerId` is unreachable.
- **Bodies are opaque** (`v.any()`): Convex indexes ownership, scoping and
  timestamps; the Zod schemas in `apps/itun/src/lib/schemas/` own the shape, so
  **every mutation parses with Zod before persisting**.
- `selectBackend()` (`src/stores/entityBackend.ts`) answers `'remote'`,
  `'signedOut'` (anonymous) or `'blocked'` (throws
  `WritesBlockedOffline`; surfaces check `canWrite`). In `'remote'`,
  `commitEntityWrite()` and its siblings write by app id (`appId` column) and
  are **awaited**: a refused write did not happen.
- Connected surfaces (`src/components/games/`, `src/components/account/`,
  `src/components/container/`) read with `useQuery` from `convex/react` under
  `AppConvexProvider`. The cache fills from `entities.listMine` and
  `entities.listWiring` (`ShelfSync` and `WiringSync`, both in
  `src/components/account/ShelfSync.tsx`): server wins, one prune guard
  (`lib/db/pruneRules.ts`). Links go through `assignLink`
  (`src/lib/links/linkRules.ts`, [ADR-037](#adr-037)),
  never across containers.

**Every store reaches Convex:** `commitEntityWrite` (pilots, mechs, crawlers),
`commitTransfer` (a cross-entity transfer, one `entities.transfer` mutation)
and `commitSoftLink` from `entityStore.ts`, `commitPatternWrite` from
`patternStore.ts`, `commitNpcWrite` from `encounterStore.ts`,
and `commitChangeLog` from `entityChangeLog.ts` sends the Change Log, whose only
copy is the Convex `changeLog` table. `apps/itun/test/convex/containerParity.test.ts`
asserts each store has a table and calls its commit; a new store needs both.
The Change Log commit is the one fire-and-forget write, and reports its own
failure. If the schema cannot
say where a record lives, the schema moves; nothing is local-only. No change may
leave data reachable from fewer places than before; a gate asserts the row is
in Convex, not the mechanism.

### Zustand stores

`apps/itun/src/stores/` ([ADR-003](#adr-003)).
`entityStore` (pilots, mechs, crawlers, softLinks) reaches persistence through
`dbStoreFor(type)`. `list(type)` hydrates
lazily, then reads synchronously. `update()` validates, commits to Convex
(remote only), writes the backend store, then `set()`s and emits the Change
Log; a refused write changes nothing. `entityStore.transfer()` moves value between entities in
one Convex mutation and one IndexedDB transaction. `activeContainerStore` is the current Game or Shelf. There is
no TanStack Query: reads are the hooks in `src/hooks/entities/` and
`convex/react`; do not add a query cache.

### Sharing

The one account-free share is the public sheet
([ADR-032](#adr-032)): `/p/:kind/:appId`, opt-in
through the `publicRead` column, read by `publicSheet.get`, toggled in
`ShareStatusDialog` → `PublicSheetPanel`. Snapshots are
retired ([ADR-036](#adr-036)): `src/routes/s/$id.tsx` is a static page saying
so, and reads nothing.

## Accounts and Games operations

Procedures (setting a deployment up, the sign-in probe, rotations, error
reporting, one-off repairs): the
[`convex-ops`](../.claude/skills/convex-ops/SKILL.md) skill. Values here are
public; secrets live only on the deployments.

|  | Production |
| --- | --- |
| Deployment | `exuberant-porpoise-183` |
| Client URL (`VITE_CONVEX_URL`) | `https://exuberant-porpoise-183.convex.cloud` |
| HTTP actions (`VITE_CONVEX_SITE_URL`) | `https://exuberant-porpoise-183.convex.site` |
| `SITE_URL` (the **frontend** origin) | `https://intheunionnow.com` |

Project `alex-jarvis:suref-itun`
([dashboard](https://dashboard.convex.dev/t/alex-jarvis/suref-itun)). The
production origin is `https://intheunionnow.com`, never a `workers.dev`
host. `apps/srd` has no accounts.

Development has no cloud deployment. `bun run dev:itun` runs a **local**
deployment (`convex dev --start vite`) and signs in through the test seam,
`ITUN_TEST_AUTH` on the local deployment and `VITE_TEST_AUTH` in the dev
server, not Discord. One-time setup: the
[`convex-ops`](../.claude/skills/convex-ops/SKILL.md#local-backend) skill.

### Deployment variables

The Convex deployment's environment, all seven names. Without the first five,
Discord sign-in fails.

| Variable | What it is | Unset |
| --- | --- | --- |
| `AUTH_DISCORD_ID` | the Discord application's OAuth2 client id | sign-in fails |
| `AUTH_DISCORD_SECRET` | its OAuth2 client secret (32 characters) | sign-in fails |
| `SITE_URL` | the **frontend** origin, not a `.convex.site` host | the OAuth callback 500s with `Missing environment variable SITE_URL` |
| `JWT_PRIVATE_KEY` | session-signing key, PKCS8 PEM with newlines as spaces; one pair with `JWKS` | sign-in fails after Discord redirects back |
| `JWKS` | its public half, `{"keys":[…]}` | as above |
| `ITUN_BOT_SECRET` | the bot's bearer credential, the same value as the bot Worker's secret | the `/bot/*` routes are off |
| `DISCORD_PUBLIC_KEY` | the Discord application's public key, as committed in `apps/discord-bot/wrangler.jsonc` | `/su invite` answers that invites are not switched on |

`ITUN_TEST_AUTH` belongs on a local or CI deployment only, never production.
`ITUN_BOT_SECRET` can act as any Discord user who has linked an account
(never their shelf or `encounterNpcs`); it lives in 1Password and on the two
deployments, never in git.

### Convex error reporting

Convex reports through the dashboard's Exception Reporting integration, not
code: queries and mutations have no network egress. It feeds Sentry project
`itun-convex` (org `susrd`, EU region). A quiet project is not evidence of a
healthy backend; re-verifying by probe is in the `convex-ops` skill. Client
side, `src/lib/connection/serverError.ts` (`serverMessage`,
`isServerRefusal`) is the only way to tell a `ConvexError` refusal from a
redacted defect; never string-match `'Server Error'`.

### Discord

One application serves the bot and web sign-in; resetting the OAuth2 secret
leaves the bot token alone. Its one redirect URI is production's
(`@convex-dev/auth` mounts `/api/auth/callback/` plus provider id `discord`):

```
https://exuberant-porpoise-183.convex.site/api/auth/callback/discord
```

### Secrets and denormalised columns

- **Secrets:** `.env.local` is gitignored and holds only URLs.
  `bunx convex env get` prints in the clear and exits 0 when missing; test by
  length (`| tr -d '[:space:]' | wc -c`). **`convex env list` prints every
  value**: use `bunx convex env list --deployment-name <name> | cut -d= -f1`,
  or the dashboard, which masks.
- **`games.summary`** (counts and the crawler's name, for `games.listMine` /
  `games.get`) is kept by `convex-helpers` triggers registered in
  `convex/model/entities.ts`, so **every mutation uses `mutation` /
  `internalMutation` from `model/entities.ts`** (Biome refuses the generated
  builders). A dashboard-written row bypasses them. `mechPatterns` and
  `encounterNpcs` lift `appId` into a column behind `by_owner_app_id`.
- **No repair lives in the repo.** A one-off repair ships as an internal
  function, runs once from the Convex dashboard's function runner, and is
  deleted with its counts recorded.

## Rules and ITUN surfaces

Enforcement depends on the **mode** a surface is in
([ADR-021](#adr-021), governing;
[ADR-022](#adr-022)). The border is
**lifecycle transactions**: changes gated by a cost or procedure. Mode names
are ours.

| Mode | Surface | Stance |
| --- | --- | --- |
| **Guided Creation** | Wizard (`/*/new`) | Builds a legal entity; enforces and teaches creation rules |
| **Free Edit** | Live Sheet (`/sheet/:kind/:id`) | Edits _state_, never runs _transactions_ |
| **Guided Play** | Dashboard (Pilot + Mech + Crawler) | Enforced play whose layers teach as they enforce |
| **Frozen** | View (`/p/:kind/:appId`, a crewmate) | Read-only; evaluates nothing |
| **Adjudicate** | Encounter (`/encounter`), later a Mediator layer | GM tooling on NPCs; enforces nothing on players |

A mode outlives its surface. Adjudicate acts on NPC instances, outside the
matrix below. Free Edit edits end-states; the same change through a guided
mode charges the cost. A house-ruled entity is built legally in the Wizard and
broken on the Live Sheet; net-new homebrew content is unsolved.

**Rule classes:** (1) **lifecycle transaction**: use a system (`activateItem`:
EP/Heat, uses), Push, the Heat Check trigger, craft / salvage / repair /
upgrade / trade (Scrap, Tech-Level gated), Downtime, Restore, spending TP;
(2) **structural coherence**: refs resolve, slot **type** holds; (3)
**quantitative cap**: slot **counts**, derived max HP / SP / EP / AP / Heat /
Cargo; (4) **free state**: current pools, conditions, remaining uses; (5)
**procedural adjudication**: turn order, initiative, range bands, Death Blow,
supply.

| Rule class | Guided Creation | Free Edit | Guided Play | Frozen |
| --- | --- | --- | --- | --- |
| Lifecycle transaction | Enforced | **Bypassed**: end-state, no cost | **Enforced + interactive** | frozen |
| Structural coherence | Enforced | **Hard** | Enforced | frozen |
| Quantitative cap | Derived | **Override w/ callout**, baseline kept | Derived | frozen |
| Free state | Set by creation | **Freely editable** | Only via transactions | frozen |
| Procedural adjudication | — | Manual | Surfaced as tooling | frozen |

Examples: using a system is a Dashboard transaction, hand-editing its uses is
free state; Push, Heat Check and the Heat Cap block are Dashboard only;
declared damage is a Dashboard transaction (SP→HP overflow, Critical confirm)
or a Free Edit set; raising max SP is an override shown "overridden from N";
an off-Tech-Level system is gated as a transaction, placeable as a free edit if
it is a real, correctly typed entity.

### Sanctioned Live-Sheet transactions

The closed list of real transactions on the Live Sheet:

| Control | Transacts | Why here |
| --- | --- | --- |
| `sheet/CrawlerEconomyControl.tsx` (Upkeep / Upgrade / Trade) | Scrap-pool draw, Upgrade-Pool credit, the Deterioration d20, the Scrap swap | The Dashboard's Crawler Major pays Upkeep only in a Game's Downtime; Solo, shelf and Mediator-less play, the Deterioration roll and Trade still happen on the sheet (Core Book p.218-223) |
| `sheet/CrawlerSheet.tsx` bay Repair | 5 Scrap of crawler TL or higher; the bay flips Intact | Reached from the bay card; the draw is advisory |
| `sheet/MechItemCard.tsx` repair + remaining uses | Field-repair Scrap; `_used` counters | Acts on the card in front of you |

Nothing blocks (a disabled button plus a visible advisory); `scrapPool` stays
hand-editable; writes are tagged `LIVE_SHEET_TXN`, except row 3
(`MechSheet.tsx`'s `repairItem` still writes `LIVE_SHEET_MANUAL`). The list is
closed: a new transaction goes on the Dashboard. In a Game's Downtime, Upkeep
is paid on the Dashboard in the Upkeep & Upgrade step only (`CrawlerSlot.tsx`,
claimed once through `downtime.spendUpkeep`, as `DASHBOARD_TXN`); the sheet's
Upkeep is editable any time.

### Destructive consequences and provenance

A destructive, irreversible consequence in Guided Play splits per
[ADR-007](#adr-007): the trigger fires, bookkeeping
applies, and destruction or a condition change waits for the player (Reactor
Overload, Critical Damage at 0 SP, meltdown). Free Edit sets the same states by
hand.

Every write goes to the per-entity, append-only Change Log, tagged
`transaction` / `override` / `manual`, emitted at `entityStore.update` into the
Convex `changeLog` table (`apps/itun/convex/changeLog.ts`), read in
`ChangeLogDrawer` behind the sheet menu through `changeLog.forEntity`. Public sheets show no history; replay is unbuilt. The
overridden-stat marker shows on the Live Sheet only.

**Status:** the Wizard enforces hard (`PilotWizard.tsx`, `MechWizard.tsx`,
`CrawlerBuilder.tsx`; `Next` gated by `lib/rules/creation.ts`; exit via
`OffRulesEscape`). The Dashboard is built at `/dashboard/$pilotId`
([architecture/dashboard.md](architecture/dashboard.md),
[ADR-038](#adr-038)). The Live Sheet is
Free Edit plus the list above, with cap overrides and revert. Place a feature
by mode, then rule class; resolve an ambiguous case here before building, and
update the matrix when a border moves.

## Combat loop

ITUN is a shared living sheet, not a game engine: play state moves through the
Zustand stores, with no combat RPCs, no turn enforcement and no undo (the
`changeLog` is provenance). Each player updates their own mech. Rules math is
pure and shared ([ADR-006](#adr-006)); bookkeeping
auto-applies, destruction waits for the player
([ADR-007](#adr-007)). Without a Game and a Mediator
([ADR-038](#adr-038)), play is on the live sheet.

```typescript
// salvageunion-reference/rules — lib/rules/heatCheck.ts
clampHeat(heat, cap)
canActivateAction(currentHeat, heatCost, heatCap) // currentHeat + heatCost <= heatCap
reactorOverloadOutcome(roll) // 1 meltdown, 2–5 system, 6–10 module destroyed, 11–19 overheat, 20 safe
performHeatCheck({ heat, currentSP, roll, now? })
performPush({ heat, heatCap, currentSP, roll, now? }) // { nextHeat, effect }
// lib/rules/takeDamage.ts — the one SP subtraction
applySpDamage(currentSp, damage) // { newSp, hpDamage: floor(damage / 2) }
mechEffectiveDamage(amount, kind, vulnerable)
applyMechDamage({ currentSP, amount, kind, vulnerable })
```

`apps/itun/src/lib/rules/heatCheck.ts` re-exports these and adds
`heatCheckPatch(effect, currentHeat?)`: the package owns math, the app owns
patches. The roller is the package's `rollDie(sides)`.

**Activation:** the Dashboard's `useActionsDeck.ts` over `activationPatch()` in
`apps/itun/src/components/dashboard/dashboardRules.ts`; cost from `itemEconomy()`
(`sheet/mechItemRules.ts`) per action via `economyForActivation()`. Boarded,
the deck is the mech's chassis, systems and modules plus the pilot's abilities
and equipment; on foot, the pilot's alone. Each `PlayAction`'s `currency`
decides EP (adds Heat, can Push) or AP. One sequential write-through
([ADR-008](#adr-008)): deduct `currentEP`,
`clampHeat`, decrement `itemUses`, `storeState.update('mech', …)`. Cross-entity
moves use `entityStore.transfer()`.

**Destructive outcomes:** `autoApplyPatch()` strips a Meltdown's `destroyed`
and returns `meltdown: true` to confirm; Critical rolls and Eject are explicit
steps. An item marked Destroyed applies at once with an Undo toast
(`sheet/destroyedUndoToast.ts`).

**Heat:** `MechSlot.tsx` and `useActionsDeck.ts` call `heatCheckOncePatch()` /
`pushPatch()` and record `lastHeatCheck`. Auto: a pass, `20`, and `11–19`
(`shutdown` + `vulnerable`, SP damage equal to heat). Player-driven: `6–10` /
`2–5` set `requiresPlayerChoice` and the player marks the item's `StatusBadge`
([ADR-009](#adr-009)); `1` is confirmed.
Push adds 2 Heat then checks, locked when `heat + 2 > heatCap` (Quick Ref
p.233); `VENT_PATCH` sets Heat 0 plus `vulnerable`; flags clear through
`MechConditionsEditor` or `shutdownTogglePatch`.

**State:** `systemConditions` / `moduleConditions` map slugs to
`'intact' | 'damaged' | 'destroyed'`, cycled by `cycleItemCondition` in
`MechSheet.tsx`, never automatically. The mech record (`src/lib/schemas/mech.ts`)
holds `currentHP`, `currentSP`, `currentEP`, `currentHeat`, `itemUses`, the
overload flags, `lastHeatCheck`, `maxSpModifier`, `maxEpModifier`,
`maxHeatModifier` and `maxCargoModifier`; derived maxima
are the package's `lib/rules/derivedStats.ts`.

**Controls:** the Dashboard (`src/components/dashboard/`) has damage and
Criticals (`MechSlot.tsx`, `PilotSlot.tsx`: `mechDamagePatch`,
`critDamagePatch`, `pilotDamagePatch`, `critInjuryPatch`), the reactor,
activation and `performCoreRoll`, Downtime (`DowntimeWizard.tsx`;
`mechBayStatus` / `medBayStatus` from `lib/rules/downtime.ts`), and the
crawler's Pay Upkeep, salvage, crafting and scrapping (`CrawlerSlot.tsx`,
`dashboardEconomy.ts` → `lib/rules/crawlerEconomy.ts`, `lib/rules/salvage.ts`,
`lib/rules/crafting.ts`, `lib/rules/scrapMech.ts`). The Live Sheet keeps the
whole crawler economy for play outside a Game's Downtime — Upkeep, Upgrade,
the Deterioration roll and Trade (`lib/rules/crawlerEconomy.ts`, mounted by
`SheetCrawler.tsx`) — and
per-card `setItemUses`, `repairItem`, `cycleItemCondition`. Gone:
`HeatCheckControl`, `TakeDamageControl`, `PilotTakeDamageControl`,
`SalvageControl`, `CraftingControl`, `DowntimeControl`, `ScrapMechControl`,
`ConditionToggle`, `QuickRollFab`, any `apply_mech_damage` RPC, `entity_refs`
table or `useUpdateMech` hook.

## Display system

State rules, point at source; no prop tables. Session rules:
[`.claude/rules/display-system.md`](../.claude/rules/display-system.md); laws:
[ruleset](design-system/ruleset.md); [ADR-026](#adr-026).

**Two card shells, not merged.** `ReferenceEntityCard`
(`packages/component-lib/src/components/referenceEntity/card/ReferenceEntityCard.tsx`)
renders every SRD entity in both apps and owns recursion (bounded by
`MAX_DEPTH`); body sections are components beside it in `card/`, pure rules in
`cardCells.ts`, `bodyBlocks.ts`, `cardChrome.ts`, `nestedSections.ts`, and
nesting sections take a `NestedCard` prop. `Card`
(`packages/component-lib/src/components/shared/Card.tsx`) is the generic
four-band container (`ModalShell`, `SheetSectionCard`, `Callout`, `Skeleton`,
app panels). The entity card does not render through `Card`; never add entity
features to `Card`. A full composition assessment found the merge impossible
without visual deltas: the frame sits on different elements (shifting every
absolute overlay 3px), ghosted sub-header tones cannot be derived inside `Card`,
the shells resolve the `cardClick` fallback in opposite directions (first-wins
vs last-wins), and the entity header tells a stat cluster from flavour prose
where `Card`'s header slot is opaque. They share `displayMode`, the controls contract,
`CardFootMeta` and `foldStatusControl`. Grids are `MasonryColumns` of ITUN's
`EntityGridRow` cells. Never hand-assemble a `label | value` readout: that is `Stat`
(ruleset §3.7).

**Sizing:** `size` (`large | medium | small`) × `extent`
(`full | head | catalog`) in `packages/component-lib/src/components/shared/displayMode.ts`,
resolved by `resolveCardDisplay`, projected by `displayBooleans`. Never add a
`compact` / `listing` prop. `depth` 0 is solo; deeper levels tighten and drop
the footer.

**Controls:** `ReferenceEntityControl` (`referenceEntityControlTypes.ts`)
through `CardControlRail`; `stepper`, `badge`, `status`, `href` render their
primitive, so the footer is meta only. `cardClick: true` makes the card
clickable; `hidden: true` keeps it off the rail. The one preset is
`navigateControl` (`referenceEntity/referenceEntityControls.ts`).

**Slots, never schemas:** no schema-specific props; a hook computes generic
overrides to spread, as `useChassisPatternConfig`
(`referenceEntity/pattern/useChassisPatternConfig.tsx`) does. Prefer
data-shape checks (`'coreTrees' in data`); `getClassSelections`
(`apps/srd/src/lib/classSelections.ts`) is the pattern.

**Choices:** `resolveChoiceView`
(`packages/salvageunion-reference/lib/resolveChoiceView.ts`) resolves
`{ datavalues, traits, prompts }`;
`ChoiceGroups` (`referenceEntity/choiceCard/ChoiceGroups.tsx`) renders,
controlled when `selections` is passed
([ADR-010](#adr-010)); ITUN wires it
through `selections` / `onSelectionChange` and
`apps/itun/src/components/shared/useEntityChoices.ts`; `readOnly` renders
statically. Grants
(`resolveGrantedEntities`) render as nested cards with a `parentSeal`.

**Linking:** `referenceEntity/entityHrefContext.ts` provides
`EntityHrefProvider`, `EntityDetailLinkProvider` (srd sets both) and
`EntityExternalLinkProvider`; ITUN opens details with `useDetailModal`.
srd renders through `apps/srd/src/components/islands/ReferenceEntityIsland.tsx`
and `SchemaViewerIsland.tsx`; ITUN layers selection and status via `controls`,
with `MechItemCard.tsx` as the reference; `shared/EntitySearcher.tsx` is the
add-modal body.

## Component catalog

One catalog in `packages/component-lib`: `bun run stories` (the `stories`
launch config, port 61000) serves it from the package's own Vite dev server —
`index.html` mounts the package-root `catalog.tsx`, and nothing builds it. It globs
the library's `src/`, `apps/itun/src/components/` and
`apps/srd/src/components/`, lists every story in the sidebar and renders one at
`#<story-id>`; it opens on `foundations--styleguide--overview`.
Story rules: [`packages/component-lib/CLAUDE.md`](../packages/component-lib/CLAUDE.md),
enforced by `src/story-coverage.test.ts`; typecheck is what proves a story
compiles.

- `catalog.tsx` preloads the reference data before it imports any story
  module, and frames every story on the paper canvas; stories add no outer
  `bg-paper`.
- `src/styles/catalog.css` imports the shared `tailwind.css` entry and adds
  `@source` for the stories and the two apps' component folders.
- **Size ladder** (`src/styles/sizing.ts`): Full, **Compact** (default), Mini;
  offer only real rungs, compose from `RUNG_TYPE` / `RUNG_INLINE_PADDING` as
  `Badge`'s `STAMP_SIZE` does.
- **Stories:** `Story` from `src/stories/_harness.tsx` (apps:
  `component-lib/stories/harness`); a static-literal default `title`; groups
  Foundations, Atoms, Containers, Compositions (sub-groups Entity, Catalog,
  Dashboard, Wizard, Shell), listed once as `storyGroups` / `storySubgroups`
  in `src/stories/_groups.ts`, which the guard and the sidebar order both read. No
  args or controls; real SRD data; don't churn export names.

## Discord bot as a Game client

An authenticated client of ITUN Games ([ADR-030](#adr-030)):
`/su me`, `/su games`, `/su shelf`, `/su crew`, `/su sheet`,
`/su game bind|unbind|info`, `/su invite` ([ADR-039](#adr-039))
and roll attribution on `/su roll`, on the `su-discord-bot` Worker. Conventions:
[`apps/discord-bot/CLAUDE.md`](../apps/discord-bot/CLAUDE.md); variables:
[deployment variables](#deployment-variables).

It calls `POST /bot/<op>` (`apps/itun/convex/botHttp.ts`); every `botClient`
function is internal. Write both credential halves in one pass (one
`openssl rand` piped to `convex env set` and `wrangler secret put`, never
printed): a mismatch fails as `unauthorized`. Verify without the secret:
`POST /bot/<op>` with none is **404** while unset, **401** once set; the
Worker's `GET /health` is 503 until both are set and shows `configured.itun:
true` (presence only). Only a real Game command proves a match.

It reads widely and writes narrowly: only existing mutations, only facts
modelled as a transaction or Change Log proposal. Not for: creating or editing
characters; a Mediator writing another player's sheet (ADR-030 §4); new
mutations for convenience (except `botClient.invite`, via
`model/invites.ts#mintInvite`); a service-role key; `apps/srd`.

### Bot authentication

- **Shared secret (built):** `Authorization: Bearer $ITUN_BOT_SECRET` plus the
  Discord id; Convex resolves `discordId → user → membership` and runs
  `model/permissions.ts`. It asserts identity, so routes stay member-level
  reads and roll recording.
- **Discord-signed (the endgame), taken for `/su invite`:** an invite creates a
  membership, so the bot forwards the raw signed body
  (`X-Signature-Ed25519`, `X-Signature-Timestamp`) to `POST /bot/invite`;
  `botHttp.ts` verifies against `DISCORD_PUBLIC_KEY`, rejects timestamps over
  five minutes old, and `invite` is absent from the args-forwarding map.
- **Per-user OAuth: rejected.**

No linking step: `authAccounts` stores the snowflake as `providerAccountId`,
resolved by `model/bot.ts#userByDiscordId`. There is always a
client: when Convex is down or unreachable every call is `unavailable`, Game
commands say so ephemerally, and `/su roll` and `/su lookup` behave the same. `resolveActor`
returns `null` alike for no binding, account or membership; passive paths stay
silent, explicit ones reply ephemerally. Open: Mediator alerts to the channel
(`proposals.broadcast`, watermarked by the Change Log) and Apply / Decline
buttons. Gaps: `/su crew` maxima (`apps/discord-bot/src/gameCards.ts`) ignore
the pilot's `PilotingContext`; unclaimed entities (`ownerId: null`) render
**Unclaimed**, never a blank owner.

## SEO and accessibility

**srd head.** `apps/srd/src/layouts/BaseLayout.tsx` renders the document from
`DocumentMeta` (`ssg/types.ts`); `ssg/document.tsx` alone reads the Vite
manifest and injects asset tags. BaseLayout never imports `.css`. Titles end in
`TITLE_SUFFIX` except home; OG images are 1200×630 (`DEFAULT_OG_IMAGE` in
`src/lib/constants.ts`); `THEME_COLOR` matches the manifest
(`constants.test.ts`); Barlow is self-hosted via `@fontsource` from
`src/runtime/styles.entry.ts` under `font-src 'self'`; speculation rules and a
cross-document `@view-transition` replace router JS.

**Endpoints** (`src/endpoints/`, `ssg/endpoints.ts`): `/llms.txt`
(`llmsTxt.ts`; ships byte for byte, never reflow), the JSON API
(`/schema/{schemaId}.json`, `/schema/{schemaId}.schema.json`,
`/schema/{schemaId}/item/{itemId}.json`; CORS in `public/_headers`), the
search index (`searchIndexJson.ts`). The service worker is `vite-plugin-pwa`'s
`generateSW` during `vite build`, configured by `ssg/pwa.ts`
(`navigateFallback: null`, `skipWaiting`, `clientsClaim`, navigations
`NetworkFirst` with a 3 s timeout);
`installChunkRecovery` reloads once when chunks are gone.

**JSON-LD** via `meta.structuredData`: `WebSite`, `CollectionPage`, `ItemPage`,
`BreadcrumbList` (`AppBar.tsx`). Meta descriptions are cut to
`META_DESCRIPTION_MAX` (155) by the reference package's `truncate`.

**No-JS fallback:** `extractStaticEntitySummary` feeds `StaticEntityContent`
(`apps/srd/src/components/StaticEntityContent.tsx`) into
`[data-static-fallback]`; `ReferenceEntityIsland.tsx` mounts with `createRoot`
(no hydration anywhere) and replaces it; `@media (scripting: enabled)` in
`apps/srd/src/styles/global.css` hides it before paint. `EntityCardStatic` is
not an island.

**Sitemap:** `ssg/sitemap.ts`; exclude with `register(page, { sitemap: false })`
in `ssg/routes.ts` (`ssg/__tests__/routes.test.ts` fails a noindexed page
without it). `src/lib/staticPaths.ts` excludes meta schemas
(`src/lib/__tests__/staticPaths.test.ts`) from `getSchemaStaticPaths()` and
`getItemStaticPaths()`; routes are slugs, never UUIDs;
`apps/srd/public/robots.txt` names the sitemap.

**Accessibility:** Biome's `a11y` group (`biome.jsonc`). Each app's
`e2e/a11y.e2e.ts` (`tools/lib/a11yScan.ts`: axe-core `wcag2a`, `wcag2aa`,
`wcag21a`, `wcag21aa`, `wcag22aa`, `best-practice`) scans the pages in
`tools/a11y-baseline.json` and `tools/a11y-baseline-itun.json` at desktop and
as a Pixel 7; a stale entry fails until a run with `A11Y_UPDATE_BASELINE=1`.
Locally: `bunx playwright test a11y.e2e.ts` in the app.
Landmarks: two labelled `<nav>`s in `AppBar.tsx`, `<main>` in `BaseLayout.tsx`,
`Footer.tsx`. One `<h1>` per page (entity pages pass `titleAs="h1"` from `EntityView.tsx`
to `EntityCardHeader`).
Clickable `Card`s are `role="button"` with Enter/Space; search
(`SearchIsland.tsx`, `useSearchCombobox`) is a combobox with
`aria-activedescendant`; breadcrumbs mark `aria-current="page"`; filter chips
are `Badge as="button"` with `aria-pressed`; `ModalShell` traps focus and
`ConfirmDialog` starts on Cancel when destructive; touch targets are 44px under
`@media (pointer: coarse)`.

**Contrast:** tokens in component-lib's `src/styles/theme.css`
(`--color-rust` is the one action colour). Entity accents never colour small
body text. Text on a tone band is `onToneText`
(`packages/component-lib/src/design/contrast.ts`); `design/contrast.test.ts`
holds sub-headers and footers at 4.5:1 and names the header tones at 3:1.

## CI and deploy

`.github/workflows/ci.yml`, `pr-title.yml`, `codeql.yml`,
`deploy-cloudflare.yml`. Workflow comments say what; this says why.

### CI: triggers

`ci.yml` runs on `pull_request` only, with **no `branches:` filter**: it
matches the base branch, so stacked PRs got no checks. CodeQL likewise, plus
`push` to `main` and weekly. The ruleset is strict, so a merged tree already
passed `CI Success` up to date with `main`; the deploy fires on the push.

### CI: concurrency

A new push to a PR cancels its superseded run. Every job declares
`timeout-minutes` (15; 25 for browser builds); never drop the key.

### CI: path filters

`shared` (reference package, observability, root config, test preloads,
workflows) affects every app; component-lib affects srd and itun. `CI Success`
passes a skipped job, so: `tools/check-workflows.ts` (`path-filters`) asserts
each app's `workspace:*` deps are in its group; root prose (`ABOUT_JRVS.md`,
`LLM_STATEMENT.md`, `SPECIAL_THANKS.md`) is `shared`, because #731 changed
only `SPECIAL_THANKS.md`, skipped `build-srd`, and turned the next three PRs
red; the Playwright base, the axe scan and
baselines are in their app's group. `code` is source, tools, `.github/` and
the Claude hooks and `settings.json`; `docs` is `docs/**`, root `CLAUDE.md` /
`README.md`, `.claude/**`, `.mcp.json` (docs-only PRs skip
the suite and typecheck); `deps` is `bun.lock` and every `package.json`.

### CI: static-checks and coverage

One step, `bun tools/check.ts --profile=ci --areas=<code,docs>`: the registry
`bun run check` and pre-push read. Always: Biome and `styling`. `code`:
`generated`, typecheck, knip, `workflows`, `actionlint`
(`tools/lint-workflows.sh`: pinned, sha256-verified actionlint and zizmor,
`.github/zizmor.yml`, every action SHA-pinned,
`persist-credentials: false`). `deps`: the audit. `code` or `docs`: `data`,
`doc-drift`, `observability`, `convex-callers` (which also holds
`convex/_generated/api.d.ts` to the modules on disk). The test gate
is `coverage`: `bun run test:coverage` (`tools/run-coverage.ts`) fails a
workspace under its `FLOORS` total (bunfigs set
`coveragePathIgnorePatterns = ["../**"]`).

### CI: build jobs

All `needs: [changes]` only. `build-srd` builds once, runs `check:examples`,
srd's whole Playwright suite (add a spec to its run line, not a job), the
axe spec among them, on that `dist`; `mobile-chromium` (Pixel 7) runs smoke in both apps.
Both apps' Playwright configs are `tools/lib/playwrightBase.ts`: in CI they
serve the build with each app's `preview` script (`wrangler dev` over its
`wrangler.jsonc`, so the specs see production's Worker and routing, CSP
bypassed), and a test that passes only on a retry fails the run
(`failOnFlakyTests`).
`build-itun` builds against a throwaway self-hosted Convex backend
(`.github/actions/convex-backend`, the one `e2e-nightly.yml` uses) carrying the
PR's own functions, so its specs (the axe spec among them) see the signed-out UI production
ships, never production itself; it also bundles the Worker (`bun --filter itun
worker:bundle`). ITUN's full browser suite is nightly (`e2e-nightly.yml`). `build-discord-bot`
and `build-su-assets` bundle Workers. wrangler is
one root devDependency that all four Worker apps run; keep each `wrangler.jsonc`
`compatibility_date` at or below its bundled workerd.

### CI: PR title

The squash title is the changelog entry ([ADR-041](#adr-041)). `pr-title.yml`
runs on `opened`, `edited`, `reopened`, `synchronize`, with no `if:` or path
filter (a required context), because `ci.yml` does not run on `edited`. The
squash body is the PR body (`squash_merge_commit_message: PR_BODY`).

### CI: aggregate gate

`quality-checks`, named `CI Success`, fails on `failure` or `cancelled`.
**Every job must be in its `needs:`** (`tools/check-workflows.ts`,
`aggregator`). The ruleset also requires `PR title is a conventional commit`
and waits on CodeQL through `code_scanning` (`GATE_WORKFLOWS`), so neither
workflow is filtered. Change the trigger on `main` before the ruleset;
never poll another workflow.

### CI: repository settings

Owner-applied.

- **`main` ruleset**, declared as `MAIN_RULESET` in `tools/environments.ts`
  and drift-checked nightly (`e2e-nightly.yml`, `environments`): `active`,
  `~DEFAULT_BRANCH`, no `bypass_actors`; `deletion`, `non_fast_forward`,
  `required_linear_history`; `required_status_checks`
  (`strict_required_status_checks_policy: true`) with `CI Success` and
  `PR title is a conventional commit`, each on `integration_id` 15368;
  `code_scanning` (`CodeQL`, `security_alerts_threshold: high_or_higher`,
  `alerts_threshold: errors`), the only CodeQL gate; no `merge_queue`.
- **Actions** (`gh api repos/SalvageUnion-io/SU-SRD/actions/permissions`):
  `allowed_actions: selected`, GitHub-owned plus `dorny/paths-filter@*` and
  `oven-sh/setup-bun@*`, with
  `verified_allowed: false` and `sha_pinning_required: true` (every `uses:` is
  a commit SHA; zizmor's `unpinned-uses` holds the YAML to it); a PR adding a
  third-party action says so.
- Code scanning default setup `state: not-configured`; private vulnerability
  reporting `enabled: true` ([`SECURITY.md`](../SECURITY.md)).

### CI: deploy set

It runs on `push` to `main` and on dispatch from `main` (`sha` rolls back;
`force_all` ships everything). `CLOUDFLARE_API_TOKEN`, `CONVEX_DEPLOY_KEY` and
`SENTRY_AUTH_TOKEN` live only in the `production` Environment; each job
reading one declares it (`secrets-env`; declared in `tools/environments.ts`,
drift-checked nightly). Public values (Convex URL, Sentry DSNs and org) are
top-level `env:`.

- **Shape:** `plan` → `build-srd` / `build-itun` → `push-convex` → `deploy`
  → `smoke` → `record`; `og-srd` renders OG images into srd's `dist` (render
  cache `apps/srd/node_modules/.cache/srd-og`). `deploy` is one matrix job, a
  leg per app in `plan`'s `deploy` output (`fail-fast: false`); it ships the
  builds' artifacts unrebuilt after **every** build is green; CI's builds are
  never shipped, and CI's `build-*` jobs are what prove each Worker bundles.
  Jobs that ship nothing (`plan`, `build-*`) take the Environment with
  `deployment: false`.
  `bun run check workflows` (`deploy-order`) asserts the edges and explicit
  status functions downstream of skippable jobs.
- **`push-convex`** asserts the deploy key's URL equals `ITUN_CONVEX_URL`
  before pushing; the backend leads the client by minutes.
- **The base is the last deploy:** `record` moves the tag
  `deployed/cloudflare`; the next run diffs against it. No record, a shared
  path or `force_all` deploys everything; the shared set includes the root
  prose files and excludes `test/` and every `.github/` file but this workflow
  and `.github/actions/`. The decision is
  `tools/deploy-surfaces.ts` (`tools/__tests__/deploy-surfaces.test.ts`). When
  HEAD is an ancestor of the record (a re-run of an older merge's deploy) the
  run is `stale`; only a dispatch (`--allow-backwards`) rolls back.
- A failed `deploy` leg skips `smoke` and `record`, so the next run redeploys.
  `record` holds `contents: write` through a REST call, in its own job. A
  dispatched `sha` reaches scripts through `env:`. The smoke list is
  `tools/smoke-production.sh`, also run daily by `e2e-nightly.yml`
  (`production-smoke`).

## Dependencies

### Dependency updates

Dependabot updates GitHub Actions only ([`.github/dependabot.yml`](../.github/dependabot.yml)):
one grouped Monday PR for `.github/workflows/` and `.github/actions/setup-bun`,
7-day cooldown, merged by hand. **Bun dependencies are
updated by hand:** `bun outdated --filter='*'`, then `bun update --latest <pkg>`
or `bun add <pkg>@<version>` in the one place that names it
([declare what you import](#declare-what-you-import)); `bunfig.toml`'s
`install.exact` makes both write an exact pin. The root
`packageManager` is the one Bun pin (setup-bun reads it), and `bun-types` moves
with it (`workflows`, `bun-version`); `.mcp.json`'s `convex@` pin moves with
`apps/itun/package.json`'s (`tools/__tests__/mcp-config.test.ts`).

### Install cooldown

`bunfig.toml` refuses versions **under 3 days old**: a pin it cannot satisfy
errors (`blocked by minimum-release-age`).
`bun install --frozen-lockfile` is unaffected. The escape hatch is
`minimumReleaseAgeExcludes` (`bun-types`), never a lower number.

### Dependency audit

`bun run audit` (the root `audit` script) fails on an advisory at any
severity. The `audit` check runs it on PRs that change `bun.lock` or a
`package.json`, and `e2e-nightly.yml`'s `audit` job runs it against the
unchanged tree, reporting through the nightly tracking issue. It suppresses
nothing; an advisory with no fixed release is answered by dropping the
dependency that reaches it, and an `--ignore` added anyway is recorded here
with its path and the condition that removes it.
Fix a transitive advisory by dedupe, then `bun update <pkg>`, then a floor.
`bun why <pkg>` prints the path.

### The overrides block

| Entry | Why |
| --- | --- |
| `sharp: >=0.35.5` | `GHSA-wq5f-xc86-pv6w`; `miniflare` pins 0.35.4. Delete once bun.lock's `miniflare` entry itself asks for ≥0.35.5 |

Floors, never exact versions. `brace-expansion` cannot be floored (two
majors). Delete an override once the package that needed it asks for the fixed
version itself (`bun why` shows the override's result, so it cannot tell you);
re-derive by emptying the block, `bun install`, `bun run check audit`.

### Declare what you import

Each workspace declares every package its shipping code imports as a
`dependency` in its own manifest, never a devDependency or trusted peer;
component-lib's `react` / `react-dom` are the exception. Each version is
written once: a package more than one workspace imports is a root
`workspaces.catalog` entry that each manifest names as `catalog:`, and a dev
tool (bundler, wrangler, test library) more than one workspace runs is a root
devDependency, which every workspace resolves.

### Dead-code gate (knip)

`bun run knip` uses `includeEntryExports: true` (off in `srd` and `su-assets`).
Delete what it flags; `@public` and `@knipignore` (tags in `knip.json`) are
the escape hatches; the
procedure is `/knip-triage`.

## Services and agent tooling

The registry of external services and MCP servers. Re-derive before trusting a
row; if the platform disagrees, fix this section. Everything here is a public
identifier: **never** add a token, DSN, bot token, OAuth secret,
`ITUN_BOT_SECRET` or Convex env value.

### MCP servers

[`.mcp.json`](../.mcp.json) is secret-free: no headers, tokens or `${VAR}`.

| Server | Transport | Auth | Reaches |
| --- | --- | --- | --- |
| `cloudflare-bindings` | `https://bindings.mcp.cloudflare.com/mcp` | OAuth | Workers, R2, KV, D1 |
| `cloudflare-observability` | `https://observability.mcp.cloudflare.com/mcp` | OAuth | Worker logs and errors |
| `sentry` | `https://mcp.sentry.dev/mcp` | OAuth | org `susrd` |
| `convex` | stdio, `bunx convex@1.45.0 mcp start --project-dir apps/itun --disable-tools envSet,envRemove,run` | `~/.convex/config.json` | ITUN deployments |
| `context7` | `https://mcp.context7.com/mcp` | none | version-pinned docs |

`claude mcp list` is the only proof a server works. GitHub has no declared
server (`https://api.githubcopilot.com/mcp/` lacks dynamic client
registration): use `gh`, or a local-scope `~/.claude.json` entry with a
`headersHelper`. `convex` refuses production unless flagged
(`--dangerously-enable-production-deployments`,
`--cautiously-allow-production-pii`); never add either. Its pin matches
`apps/itun/package.json`. It targets the local deployment named by
`CONVEX_DEPLOYMENT` in `apps/itun/.env.local` (written by `bun run dev:itun`;
`.worktreeinclude` copies it into Claude Code worktrees), which answers only
while `bun run dev:itun` runs; with no file every call fails
`No CONVEX_DEPLOYMENT set`. `context7`
returns condensed docs: verify load-bearing APIs against `node_modules`.

### Cloud sessions

`gh` is absent: use the session's `mcp__github__*` tools, loaded with
ToolSearch first (`select:mcp__github__create_pull_request,…`). The remote MCP
hosts (`bindings.mcp.cloudflare.com`, `observability.mcp.cloudflare.com`,
`mcp.sentry.dev`, `mcp.context7.com`) fail (`ERR_PROXY_TUNNEL`, 403) unless
the environment allows them; report those signals **unread**. `convex` has no
credentials: ask for data. If `bun --version` differs from the root
`packageManager`, run with `PATH="$HOME/.local/share/su-srd-bun/<version>:$PATH"` (the
SessionStart hook installs it there) and `bun install --frozen-lockfile`. Never fake
a GitHub step that has no route.

### Cloudflare

Everything runs here ([ADR-033](#adr-033)), account
`alxjrvs@gmail.com`, shared with RANDSUM (accepted risk, ADR-033 §6).

| Worker | Serves | Bindings |
| --- | --- | --- |
| `su-srd` | `salvageunion.io`, `www.` | none (Static Assets) |
| `su-itun` | `intheunionnow.com`, `www.` (Static Assets, SPA mode; the script answers non-navigation misses) | `ASSETS` |
| `su-assets` | `assets.salvageunion.io` | R2 `LP_ASSETS`, `IMAGES` |
| `su-discord-bot` | Discord interactions | secrets only |

R2: `su-lp-assets`, and `su-itun-snapshots`, which nothing binds since
[ADR-036](#adr-036)'s amendment (deleting it is the owner's call).
Zones `salvageunion.io` and `intheunionnow.com`. Only `su-srd` and
`su-discord-bot` answer on `alxjrvs.workers.dev`. `su-assets` caches its
responses with Workers Caching (`cache.enabled`). Re-derive with
`wrangler deployments list`, `wrangler r2 bucket list` and the
`apps/*/wrangler.jsonc` files.
**Outside the repo:** Always Use HTTPS (both zones), the `www` → apex Redirect
Rule and per-zone Images Transformations; see
[configuration outside the repo](#configuration-outside-the-repo).

### Sentry

Org **`susrd`**, **EU region** (`https://de.sentry.io`,
<https://susrd.sentry.io>); a DSN from another region silently fails.
Four projects: `srd` and `itun` (`VITE_SENTRY_DSN` at build, from
`deploy-cloudflare.yml`'s public `SRD_SENTRY_DSN` / `ITUN_SENTRY_DSN`
constants), `itun-convex` ([dashboard toggle](#convex-error-reporting); IP
storage off), and `workers` (one `SENTRY_DSN` on `su-itun`, `su-discord-bot`
and `su-assets`, told apart by `server_name`, which is the wrangler `name`).
`su-srd`'s Worker reports into `srd` instead, beside the browser bundle, under
`server_name` `su-srd`; its `SENTRY_DSN` secret is the `SRD_SENTRY_DSN` constant.
One org alert rule on users or volume covers them, and the uptime monitor
watches `intheunionnow.com`.

No DSN tree-shakes the SDK out, and a `connect-src` missing the ingest origin
blocks every event, so `tools/check-observability.ts` checks DSN gating and
CSP on parsed source and pins `https://*.ingest.de.sentry.io`; deploy builds fail with no DSN
inlined, and `tools/smoke-production.sh` checks the served CSP. CSP sources:
`apps/srd/public/_headers` and `apps/itun/public/_headers`;
change CSP or region in lockstep. Sourcemaps upload only from
`deploy-cloudflare.yml`, through `sentrySourcemaps()` in `observability/vite`
(gated on `SENTRY_AUTH_TOKEN`; one org token, the workflow's `SENTRY_ORG`, and
the literal project `srd` or `itun`).

### Convex and GitHub

- **Convex:** project `alex-jarvis:suref-itun`; deployments in
  [Accounts and Games operations](#accounts-and-games-operations).
  `.convex.site` is HTTP actions, `.convex.cloud` the client; swapped, they
  read as "unreachable". Modules: [`apps/itun/convex/`](../apps/itun/convex/).
- **GitHub:** [`SalvageUnion-io/SU-SRD`](https://github.com/SalvageUnion-io/SU-SRD),
  `main`; the deployed commit is the release ([ADR-041](#adr-041)).

Re-derive: `claude mcp list`; Sentry MCP `find_organizations` /
`find_projects`; `bunx convex mcp start` → `status`.

# Decisions

The architecture decision records, one `## ADR-NNN` each, in number order.
Read an ADR's **Status** first: a superseded or merged ADR says so only there.
A new decision takes the next number and goes at the end; an amendment is a
dated paragraph in the Status of the ADR it amends. Numbers are never reused.

## ADR-001

**Local-First, No Backend, No Auth**

### Status

**Superseded by [ADR-030](#adr-030)**
(accounts, Games, and Convex as the server of record), whose remaining Solo
guarantee [ADR-034](#adr-034) then withdrew.

Full text: `git show c2476d1c:docs/adrs/ADR-001-local-first-no-backend.md`

## ADR-002

**IndexedDB via `idb`, Zod as the Schema Source, Strict Reads**

### Status

Accepted. **Amended 2026-10-08 (#1152):** IndexedDB is a cache of Convex
([ADR-034](#adr-034)), so a version change no longer migrates records — the
upgrade empties the cache and the server refills it. The migrations system the
decision below once pointed to is deleted. **Amended 2026-10-09 (#1181):**
reads are strict. The lenient salvage re-parse and the read-time legacy
normalizers are deleted: an unreadable cached row is skipped with a warning and
refilled from Convex, and the build floor reloads a tab too old to read what
the server serves.

### Context

Given the local-first decision ([ADR-001](#adr-001)),
ITUN needs durable in-browser storage for pilots, mechs, crawlers, workspaces,
soft-links, and mech patterns. The options were a higher-level wrapper (Dexie),
raw IndexedDB, or a thin promise wrapper.

Two forces shaped the choice:

1. **One source of truth for shape.** ITUN already validates entities with Zod
   schemas (`apps/itun/src/lib/schemas/`). A second schema language
   (e.g. Dexie's index DSL describing the same entities) would be a parallel
   definition to keep in sync.
2. **PWA version skew.** Because ITUN is an auto-updating PWA, a tab can be
   running an older bundle than the data on disk was written by (or vice versa).
   A strict read that throws on an unexpected field would corrupt the user's
   experience after a deploy.

### Decision

- Persist via **`idb`** (v8), a thin promise wrapper over native IndexedDB — not
  Dexie. Object stores are declared in `apps/itun/src/lib/db/`.
- **Zod schemas are the single source of truth** for entity shape. The DB layer
  parses on read/write rather than maintaining a separate storage schema.
- Reads are **strict** (amended, #1181): an unreadable cached row is skipped
  with a warning and refilled from Convex. See `apps/itun/src/lib/db/crud.ts`.
- A schema/version change bumps `DB_VERSION` in `apps/itun/src/lib/db/index.ts`;
  the upgrade drops every store and the cache refills from Convex.
- Reusable mech templates live in their own `mechPatterns` object store rather
  than as a boolean flag on mech records, so they can list and evolve
  independently (`apps/itun/src/lib/schemas/pattern.ts`).

### Consequences

- No parallel schema DSL: change a Zod schema and the DB layer follows.
- One unreadable row never bricks hydration of its store: it is skipped, not
  thrown on.
- `idb` keeps the abstraction thin — complex querying is done in memory in the
  Zustand stores ([ADR-003](#adr-003)), not via a query DSL.
- A tab too old to read a field a newer build wrote skips that row until the
  build floor reloads it.

## ADR-003

**Client State via Zustand — Lazy Auto-Hydration, Write-Through, Cross-Tab via Convex**

### Status

**Superseded by [ADR-034](#adr-034) and [ADR-030](#adr-030)**, except the
lazy-hydration rule. IndexedDB is a cache of Convex: a write commits to the
server first and reaches the cache only once the server accepts it, and tabs
stay in step through their own Convex subscriptions
([Zustand stores](#zustand-stores)). What stands: the Zustand stores in
`apps/itun/src/stores/` hydrate a collection from the cache on its first
`list(type)` and answer synchronously from memory after that, so no caller
awaits hydration, and filtering happens in memory, which keeps the DB layer a
thin `idb` wrapper.

Full text: `git show c2476d1c:docs/adrs/ADR-003-zustand-hydration.md`

## ADR-004

**Snapshot Sharing via Unauthenticated Netlify Functions + Blobs**

### Status

**Superseded by [ADR-036](#adr-036)** (2026-10-06) — snapshots are retired; previously Accepted, and amended by ADR-033.

Full text: `git show c2476d1c:docs/adrs/ADR-004-snapshot-netlify-functions.md`

## ADR-005

**Game-Data ORM — Zod as Source, Generated JSON Schema, Lazy Data Loading**

### Status

Accepted

> **2026-09-25 amendment (audit PK-04):** "Zod schemas stay statically
> imported" no longer holds for the *load path*. `preload()` is trusted by
> default — CI validates the committed data and a test proves it is
> parse-stable — and reaches the schemas through a dynamic `import()` only for
> `{ validate: true }`, so they drop out of client bundles. Zod remains the
> single source of types, JSON Schema and CI validation; that half is unchanged.
>
> **2026-09 amendment:** the `{ validate: true }` option is gone. No runtime
> caller used it, so `preload()` never parses and no runtime module imports the
> schemas at all; tests and tools import them directly.

### Context

Every app consumes the same Salvage Union reference data (chassis, systems,
modules, equipment, abilities, NPCs, roll tables, …). That data needs to be:
typed at the call site, validated against a schema, queryable by id/slug/cross-
reference, and shareable across a static site, a React app, and a Node Discord
bot — without each app re-implementing access or shipping the whole dataset when
it only needs part of it.

### Decision

`packages/salvageunion-reference` is a **typed ORM over a schema-validated JSON
dataset**:

- **Zod schemas (`lib/schemas/`) are the source of truth.** `*.schema.json`
  files are **generated** from them by `bun run build:package`; they are never
  hand-edited. `dist/` is likewise generated.
- Models extend `BaseModel<T>`, are created via `ModelFactory`, and are reached
  through static accessors: `SalvageUnionReference.Chassis.find(...)`, etc.
- **Data JSON is imported lazily/dynamically** so consumers code-split and don't
  pull the entire dataset eagerly; Zod schemas stay statically imported.
- Consumers must `preload(...)` the schemas they use before synchronous data
  access (the Discord bot preloads everything at startup).
- All Zod usage goes through `lib/zod.ts`, which configures CSP-safe parsing (see
  [ADR-013](#adr-013)).

### Consequences

- One change to a Zod schema updates types, runtime validation, and the
  generated JSON Schema together — no drift between them.
- Apps pay only for the data they load; the dataset doesn't bloat every bundle.
- Access is uniform and typed across all consumers (web, ITUN, bot), and the data
  layer carries no UI or backend dependency, which lets rules logic build on it
  ([ADR-006](#adr-006)).
- The build step is a hard prerequisite: apps can't resolve types until
  `bun run build:package` has run. This is the most common first-run gotcha.
- Forgetting `preload` surfaces as empty/missing data at runtime rather than a
  type error — a known sharp edge of lazy loading.

## ADR-006

**Rules / Combat Logic as Pure Functions in `salvageunion-reference`**

### Status

Accepted

**Amended 2026-09** — the RNG binding moved into the package. `lib/rules/dice.ts`
exports `rollDie(sides)`, a `crypto.getRandomValues` roller that replaced the
`@randsum/roller` calls in ITUN and component-lib, ITUN's `defaultRoll` among
them. The binding stayed app-local only because it pulled in that dependency;
a platform global does not. Every other rules function still takes the `Roll` as a parameter, so they
stay deterministic. Where the text below says the package does not own the RNG
binding, read it as history.

### Context

Salvage Union's mechanics — heat generation, heat checks, push conditions,
action affordability, damage resolution — are shared across surfaces: ITUN
applies them to a live mech sheet, and the Discord bot rolls on the same tables.
If this logic lived inside ITUN's React/state layer, the bot couldn't reuse it
and it couldn't be unit-tested in isolation. If it depended on a backend, it
would violate [ADR-001](#adr-001).

### Decision

Game rules logic lives as **pure, side-effect-free functions** in the data
package (`packages/salvageunion-reference/lib/rules/`, reached via the
`salvageunion-reference/rules` subpath export):

- Functions take state in and return results out — no I/O, no mutation of inputs,
  no backend or storage dependency (`clampHeat`, `canActivateAction`,
  `performHeatCheck`, `performPush`, `applySpDamage`, `applyMechDamage`, etc.).
- Applying a result to durable state is the **consumer's** job: ITUN persists via
  its stores ([ADR-003](#adr-003)) using sequential
  client-side mutations ([ADR-008](#adr-008)); the bot
  formats output for Discord.

### Consequences

- The same rules power ITUN and the bot with no duplication.
- Pure functions are trivially unit-testable without a DOM, store, or network.
- A clean seam separates "what the rules say" (this package) from "what the app
  does about it" — UI/state decisions don't leak into rules math.
- The automation boundary ([ADR-007](#adr-007)) governs
  _which_ of these results the app applies automatically versus surfacing for
  player confirmation; this ADR only governs _where the math lives_.

### Status update (2026-07): ITUN rules-module migration

For a long stretch after this ADR was accepted, only `combatUtils.ts` and
`rollOnTable.ts` actually lived in the package (`combatUtils.ts` no longer
exists — it was later folded into `lib/rules/`, its two live functions landing
in `rules/heatCheck.ts` and `rules/takeDamage.ts` and its five unused ones
deleted, so that path is history, not a live location) — the bulk of the rules engine
(21 modules) had grown up locally in
`apps/itun/src/lib/rules/` instead, so the "shared by ITUN and the
Discord bot" promise wasn't yet true beyond those two files. A migration
project moved the fully-portable modules into
`packages/salvageunion-reference/lib/rules/`, executed in dependency-ordered
tiers:

**Tier 1 — moved (zero ITUN-schema coupling):** `capacity.ts`, `cargo.ts`,
`crawlerCapacity.ts`, `scrap.ts`, `resolveRefs.ts`, `pilotSnapshot.ts`,
`crawlerSystems.ts`, `softWarnings.ts`, `detailWarnings.ts`, and the
structural-type module `types.ts` (its own header comment had anticipated
exactly this move — "this module is file-disjoint from schemas... Zod schemas
will satisfy these structural shapes automatically").

**Tier 2 — moved (small outcome-shape types generalized structurally):**
`takeDamage.ts`, `coreMechanic.ts`, `derivedStats.ts`, `mediatorTables.ts`, and
the pure half of `heatCheck.ts` (`clampHeat`, `reactorOverloadOutcome`,
`performHeatCheck`, `performPush`). Several of these modules turned out to
import outcome/result types (`HeatCheckResult`, `ReactorOverloadOutcome`,
`CriticalDamageResult`/`Outcome`, `CriticalInjuryResult`/`Outcome`,
`MediatorRollResult`, `MediatorTableId`) directly from ITUN's Zod schemas — a
tighter coupling than a pre-migration survey had assumed for some of them.
These were generalized into small structural types in the package's
`types.ts` (the same "outcome/result record shape, not a full persisted
record" treatment already used for `derivedStats.ts`'s `Pick<Mech/Pilot/
Crawler, ...>` parameters); ITUN's Zod-inferred types satisfy them
structurally with no behavior change. `heatCheck.ts`'s `@randsum/roller`
binding (`defaultRoll`) and `Partial<Mech>` patch assembly (`heatCheckPatch`)
stayed in ITUN, per the automation-boundary split
([ADR-007](#adr-007)) — the package only owns the
deterministic math, not the RNG binding or the write-through shape.

Every migrated ITUN module became a thin re-export shim at its original path
(re-exporting the same public API from `salvageunion-reference`) rather than
being deleted, because ~40 ITUN call sites import these by submodule path
(e.g. `../../lib/rules/capacity`), not through the `lib/rules` barrel — the
shim pattern kept every call site unchanged while the implementation now
lives in the package.

**Tier 3 — deferred, not yet migrated:** `crawlerEconomy.ts`, `salvage.ts`,
`crafting.ts`, `scrapMech.ts`, and `downtime.ts` remain app-local in
`apps/itun/src/lib/rules/`. These modules are deeply coupled to
full persisted records and to `CargoLot` construction via ITUN's
`makeUnitLot()` (which calls `crypto.randomUUID()` — app/runtime machinery,
not pure rules math), so the extraction boundary is less mechanical than
Tiers 1–2 and was left for a follow-up: `crawlerEconomy.ts`'s pure math
(once `ScrapPool` becomes a package structural type) is the next entry point,
with its `DOWNTIME_UPKEEP_SCRAP` constant flipping ownership to the package
(`downtime.ts` would then import it back, not the reverse); `salvage.ts`,
`crafting.ts`, `scrapMech.ts`, and `downtime.ts` would keep their
`CargoLot`-building code in ITUN as thin wrappers around pure math moved out
into the package.

The Discord bot was intentionally left untouched by this migration — wiring
the newly-portable rules into the bot is a follow-up consequence of this ADR,
not part of the migration itself.

**Follow-up (2026-07): the pure pass-through shims were removed.** Eight of
the Tier 1/2 shims (`capacity`, `cargo`, `crawlerSystems`, `pilotSnapshot`,
`scrap`, `detailWarnings`, `resolveRefs`, `softWarnings`) contained nothing but
re-export lines, so their call sites now import from
`salvageunion-reference/rules` directly. The barrel
`apps/itun/src/lib/rules/index.ts` was deleted with them — it had no importers.
The remaining `apps/itun/src/lib/rules/*` modules are **not** shims: they either
re-export the pure math _and_ add app-layer code this ADR's split with
[ADR-007](#adr-007) keeps out of the package (RNG bindings
such as `defaultRoll`, write-through patch builders typed against ITUN's Zod
`Mech`), or are full app-local Tier 3 implementations. Collapsing any of those
would violate the boundary.

## ADR-007

**Automation Boundary — Smart Bookkeeping, No Automatic Destruction**

### Status

Accepted

### Context

When ITUN applies combat results to a mech sheet, a recurring question is which
events the app should apply automatically and which require explicit player
action. An inconsistent boundary (auto-applying some destructive outcomes but not
others) produces a confusing experience and surprises players with destroyed gear
they didn't choose.

### Decision

**The app automates resource bookkeeping and enforces the rules. It never
changes an item's condition without explicit player action.**

Auto-applied (non-destructive, recoverable):

- Heat generated when using an action; AP/EP spent; item uses decremented
  (`activateItem` in the mech sheet performs these as sequential mutations —
  see [ADR-008](#adr-008)).
- Heat clamping to the cap; Heat Check prompt when heat is gained.
- SP damage from a Reactor Overload high roll (damage = current heat), and other
  pure bookkeeping computed by the rules functions
  ([ADR-006](#adr-006), `lib/rules/heatCheck.ts`).
- Blocking an action when resources are insufficient or the heat cost would
  exceed the cap.

Requires explicit player action (destructive, irreversible):

- Any condition change on equipment (intact → damaged → destroyed), driven only
  by the player via the card's status badge (`StatusBadge` from
  `component-lib`, cycled by `cycleCondition` in
  `apps/itun/src/components/sheet/mechItemRules.ts`) — see
  [ADR-009](#adr-009).
- Destroying a Module or System from any source; catastrophic meltdown.

The principle: **smart bookkeeping, hands-off on permanent consequences.** Roll
outcomes that imply destruction surface the choice; they do not silently mutate
the sheet.

### Consequences

- Players never find a destroyed item on their sheet they did not choose;
  narrative surprises stay at the table, not in the app.
- Any new combat mechanic must be classified against this boundary before it's
  built: pure bookkeeping may auto-apply; anything that destroys or downgrades
  equipment must be player-driven.
- This boundary is why rules functions ([ADR-006](#adr-006))
  return results rather than apply them — the consumer decides what crosses the
  line into durable, destructive state.

## ADR-008

**Action Execution via Sequential Client-Side Mutations**

### Status

Accepted

### Context

Using an action changes several pieces of mech state at once: spend EP, apply
heat, decrement the item's remaining uses. With a backend, this would be one
atomic transaction (a single RPC). But there is no backend
([ADR-001](#adr-001)); state changes are applied
client-side through the Zustand stores
([ADR-003](#adr-003)), which write through to IndexedDB one
update at a time.

The choice was between building a client-side transaction/rollback mechanism over
IndexedDB, or accepting sequential mutations with their failure mode.

### Decision

Action execution applies **sequential, independent client-side mutations** via
the store. In `activateItem` (the mech sheet), EP is spent, then heat applied,
then uses decremented — each a separate `update`. There is **no atomic
transaction and no automatic rollback**; the rare partial-application failure
mode is accepted rather than engineered away.

Affordability is checked **before** execution (the automation boundary,
[ADR-007](#adr-007), blocks an action whose resources or
heat cost can't be paid), so the common failure causes are prevented up front
rather than rolled back after the fact.

### Consequences

- The state layer stays simple: no bespoke transaction manager over IndexedDB.
- The accepted risk is a partial mutation if execution is interrupted mid-
  sequence (e.g. EP spent but uses not decremented). Pre-execution validation
  makes this rare, and the user can correct state manually (state is local and
  directly editable).
- If a future mechanic genuinely cannot tolerate partial application, that case
  warrants its own transactional treatment and an ADR superseding this one — it
  does not change the default.

## ADR-009

**Item Condition Model and Destroyed Semantic Color**

### Status

Accepted

### Context

Mech equipment in Salvage Union moves through condition states, and the player
drives those transitions (per the automation boundary,
[ADR-007](#adr-007)). The UI needs one consistent control
and color language for condition, including how a "destroyed" item reads
visually — and the SU brand palette (rust/grey/yellow hazard tones) doesn't
contain an unambiguous "this is destroyed" signal.

### Decision

- Equipment condition is a **tri-state**: `intact` → `damaged` → `destroyed`,
  cycling back to `intact`. It is modeled as `ItemCondition` and driven by the
  card's status badge (`StatusBadge` from `component-lib`), cycled by
  `cycleCondition` in `apps/itun/src/components/sheet/mechItemRules.ts`.
- The control is **player-driven and keyboard-accessible**: given an `onClick`,
  `StatusBadge` wraps the badge in a native `<button type="button">`; without
  one it renders a plain, non-interactive `Badge`, the **read-only mode** for
  read-only sheets.
- Condition maps onto the badge tones `ok` / `warn` / `bad` (intact, damaged,
  destroyed), styled `bg-status-ok` / `bg-status-warn` / `bg-status-bad`.
  **Destroyed reads as semantic red**: `--color-status-bad` is
  `--color-roll-cascade`, `rgb(176, 67, 43)` — deliberately a semantic status
  color, **not** a Salvage Union brand token.

### Consequences

- Condition has one source of truth (`ItemCondition` + `cycleCondition`) reused
  wherever equipment condition is shown or edited.
- "Destroyed" is unambiguous because it uses a conventional danger color rather
  than a brand tone that players might not read as a warning.
- The same component serves editable and read-only sheets, so condition renders
  consistently across both.
- Using a non-brand semantic color is intentional; don't "fix" it to a brand
  token — legibility of the destroyed state is the priority.

## ADR-010

**Choices in the Shared Display — Ephemeral in the SRD, Persisted in ITUN**

### Status

Accepted

### Context

Some reference entities carry **choices**: a class ability that grants a "Custom
Sniper Rifle" with options to pick, or free-text fields like a pilot's Name /
Appearance / A.I. Personality. The same entity-display components in
`component-lib` render in two very different surfaces:

- **`srd` (the SRD reference)** — a static, read-only catalog
  ([ADR-012](#adr-012)) with no user data and nowhere to
  save a selection.
- **ITUN (the live builder)** — where a player's selections are part of their
  character and must persist ([ADR-002](#adr-002),
  [ADR-003](#adr-003)).

If the shared components owned persistence, they'd drag ITUN's storage concerns
into the static site; if they hard-coded read-only behavior, ITUN couldn't make
choices editable. Published snapshots add a third, read-only-but-has-a-value
case.

### Decision

The shared choice components are **agnostic to persistence**, and the consuming
surface decides the behavior:

- `ChoiceGroups` (selectable options) is **uncontrolled / ephemeral** in
  `srd` and **controlled / persistence-wired** in ITUN — both via the same
  `selections` / `onSelectionChange` pair, owned by the parent display.
- `FreeTextChoiceCard` takes a **`readOnly`** flag. The SRD reference and
  read-only snapshots pass `readOnly` so the card renders the prompt (or a saved
  value) as **static text instead of an editable input**; ITUN's live builder
  leaves it editable. This is the "keep editable inputs out of the SRD
  reference" rule.
- `StaticChoiceCard` is the display-only variant (e.g. NPC motivations, "choose
  one of the following" lists) that borrows the choice-card chrome with no
  toggle, status, or input.

### Consequences

- One set of components serves the static catalog, the live builder, and
  read-only snapshots; the SRD never ships editable inputs or persistence code.
- Adding a new choice-bearing entity works in all three surfaces for free,
  provided the component stays persistence-agnostic.
- The contract to preserve: **the shared library never persists.** Selection
  ownership and storage live in the consumer (ITUN), passed down through the
  `selections` / `onSelectionChange` props. Don't push storage into `component-lib`.
- See `docs/ARCHITECTURE.md#display-system` for the full choice-card layer and
  resolved-data-row rendering.

## ADR-011

**`component-lib` Ships as TypeScript Source (No Build Step)**

### Status

Accepted

### Context

`component-lib` is the shared component library consumed by both `srd`
(Astro) and ITUN (Vite). A conventional library would compile to `dist/` and
publish built artifacts. In a Bun workspace where every consumer already runs a
bundler that understands TypeScript, a build step for the shared package adds a
rebuild-before-consume cycle, a source-of-truth split between `src/` and `dist/`,
and a class of "stale build" bugs.

### Decision

`component-lib` has **no build step**. It exports TypeScript source directly:
`package.json` `exports` points `"."` at `./src/index.ts`, and consumers import
the `.ts`/`.tsx` source, which their own Vite/Astro pipeline compiles.

- React and other shared libraries are **peer dependencies**, so consumers
  control the versions and the dependency tree isn't duplicated.
- The package stays **data-source agnostic** — it depends on `salvageunion-
reference` types but knows nothing about IndexedDB, snapshots, or persistence
  (consumers inject behavior via slot props; see
  [ADR-010](#adr-010) and
  `docs/ARCHITECTURE.md#display-system`).

This is **deliberately different** from `salvageunion-reference`, which _does_
build ([ADR-005](#adr-005)) because it generates JSON Schema
and ships compiled output.

### Consequences

- Edit a component and consumers see it immediately — no rebuild, no stale
  `dist/`.
- No published artifact and no `dist/` to keep in sync; `src/index.ts` is the
  single source of truth.
- Consumers compile `component-lib`'s source themselves. A Tailwind consumer
  imports `component-lib/styles/tailwind.css`, whose `@source` scans the
  library; a consumer wired without it renders unstyled components.
- Peer deps mean a consumer that omits a required peer (React, etc.) fails at
  install/resolve time rather than shipping a duplicate copy.

## ADR-012

**`srd` as an Astro Static Site with React Islands**

### Status

**Superseded by [ADR-031](#adr-031)**, which keeps this
decision (static, pre-rendered, no backend, React islands) and replaces only the
framework: Astro gave way to the in-house generator at `apps/srd/ssg/`.

Full text: `git show c2476d1c:docs/adrs/ADR-012-srd-astro-static.md`

## ADR-013

**CSP-Compliant Zod (Jitless) as a Cross-Cutting Constraint**

### Status

Accepted

### Context

Zod v4 ships a JIT object parser that compiles validators with `new Function(...)`
for speed. `new Function` is an `eval`-family feature, so it is blocked by a
strict Content Security Policy that omits `unsafe-eval`. `srd` serves a CSP
that denies `eval` ([ADR-012](#adr-012)), and Zod is the
backbone of the reference ORM ([ADR-005](#adr-005)) and
ITUN's entity validation. Left at its default, Zod's JIT would throw a CSP
violation at runtime in the browser.

### Decision

All Zod usage flows through a single module —
`packages/salvageunion-reference/lib/zod.ts` — which configures Zod with
`z.config({ jitless: true })`, disabling the JIT parser. **Import `z` from this
module** wherever schemas are constructed, rather than importing `zod` directly.

### Consequences

- Schema validation runs under a strict, `eval`-free CSP in the browser.
- There is a small validation-throughput cost from disabling the JIT; it is
  negligible for this dataset and worth the security posture.
- A new direct `import { z } from 'zod'` bypasses the config and can reintroduce
  the CSP violation — schema code must import `z` from the shared module. This is
  the one easy-to-miss rule that keeps the constraint enforced.

## ADR-014

**Dataset Public Interface Is the JSON API; npm Publishing Is Retired**

### Status

Accepted. Its substantive decision (the served JSON API is the public
interface; npm publishing stays retired) still governs.

**Amended by [ADR-040](#adr-040) (2026-10-08).** The CHANGELOG clause is
replaced: [ADR-025](#adr-025) had unfrozen the package's `CHANGELOG.md` into a
release stream, and ADR-040 deletes the file and the stream. ADR-040 also
fixes what the API serves: the committed data and schema files, verbatim.

### Context

`packages/salvageunion-reference` was historically published to npm (133
versions exist on the registry, latest `2.4.0` at the time of writing). The
package ships TypeScript source directly and has no compile step
([ADR-011](#adr-011) established this pattern
for `component-lib`; `salvageunion-reference` follows the same shape) — `bun run
build:package` only regenerates `schemas/*.schema.json` from the Zod source
([ADR-005](#adr-005)). Publishing TypeScript source to
npm as a library was never a good fit for external consumers, and the repo
owner has decided to stop publishing it altogether.

Since `apps/srd` added `/schema/v1` JSON API endpoints (#107), it has
served the same dataset publicly as a CORS-enabled JSON API — one JSON
document and one JSON Schema document per schema, plus per-item lookups:

- `apps/srd/src/pages/schema/[schemaId].json.ts` — full dataset for a
  schema
- `apps/srd/src/pages/schema/[schemaId].schema.json.ts` — the schema's
  JSON Schema
- `apps/srd/src/pages/schema/[schemaId]/item/[itemId].json.ts` —
  single-item lookup
- `apps/srd/src/pages/api.astro` — human-readable documentation of the
  above, plus `llms.txt` for machine discovery

> **File paths above are as of this decision and have since moved**
> ([ADR-031](#adr-031) replaced Astro with the in-house SSG). The
> URLs are unchanged; the modules are now
> `apps/srd/src/endpoints/{schemaJson,schemaDefinitionJson,itemJson,llmsTxt}.ts`,
> registered in `apps/srd/ssg/endpoints.ts`, and the `/api` page is
> `apps/srd/src/pages/api.page.tsx`. What this ADR decided is untouched.

This API requires no install, no auth, and no build step — it is strictly
easier for an external consumer to use than an npm package that ships raw
TypeScript. The package's own `README.md` already documents a deprecation
notice pointing at this API, and `package.json` is already `private: true`.
However, that notice only exists in the repository; it is not reflected on
the live npm registry listing (fixing that requires the repo owner's own npm
publish credentials to run `npm deprecate`, which is a separate manual step
outside this decision's scope).

**Version discrepancy, noted here for the record (not "fixed" by this ADR):**
the local `package.json` `version` field reads `2.3.5`, but the npm
registry's latest published version is `2.4.0` — local is _behind_
published. The full git history of `packages/salvageunion-reference/package.json`
(across all branches) never contains the string `2.4.0`; the version field
progresses `2.3.4` → `2.3.5` and stops there locally. There is also no
npm-publish workflow anywhere in `.github/workflows/` — every one of the 133
versions on the npm registry was published by hand (`npm publish`), never by
CI. The npm-published `2.4.0` package metadata's `repository` field points to
`alxjrvs/salvageunion-data`, a standalone repo that now 404s on GitHub —
different from (and older than) the `SalvageUnion-io/SU-SRD` URL already
correct in the local `package.json`. Taken together, this indicates
`salvageunion-reference` originated as a standalone repo
(`alxjrvs/salvageunion-data`) later absorbed into this monorepo, and `2.4.0`
was published by hand from that old standalone checkout (or some other
out-of-band location) after the absorption — it was never synced back into
`SU-SRD`'s git history. Local `2.3.5` is the accurate source-of-record for
this repository; `2.4.0` on npm is an orphaned publish from outside this
repo's history. This ADR does not change the local `version` field.

### Decision

- The dataset's public interface is the `srd` JSON API, not an npm
  package. External consumers should fetch
  `https://salvageunion.io/schema/{schemaId}.json` (and the sibling
  `.schema.json` / item endpoints), not `npm install salvageunion-reference`.
- `packages/salvageunion-reference` remains a **private, workspace-internal**
  module, consumed only via the `workspace:*` protocol by other packages in
  this monorepo. It is not published to npm going forward.
- npm-publish-only metadata in `packages/salvageunion-reference/package.json`
  (`files`, `keywords`, `engines`, `repository`, `bugs`, `homepage`, `author`)
  is removed as dead weight, since it has no effect once the package is never
  packed or published. `private: true`, `description`, `license` (and the
  `LICENCE` file, which remains legally load-bearing regardless of
  distribution channel), and the `exports` map remain — they are load-bearing
  for the workspace-internal resolution path or otherwise still useful.
- The package's `CHANGELOG.md` is frozen as a historical record (see the note
  added at its top) rather than deleted or continued, since there is no
  future npm release for it to document.
- Actually deprecating the live npm registry listing (`npm deprecate
salvageunion-reference`) is **out of scope for this decision** — it
  requires the repo owner's own npm publish credentials and is being handled
  separately.

### Consequences

- Documentation (`docs/ARCHITECTURE.md#packages-and-contracts`, this ADR) now
  matches the package's actual `package.json` shape: no `dist/`, no build
  step, no npm distribution.
- External consumers have one clear, always-current integration path (the
  JSON API) instead of two (a stale npm package and the API).
- The npm registry listing for `salvageunion-reference` is not touched by
  this change — `npm install salvageunion-reference` will continue to
  silently succeed against the last-published version until the repo owner
  runs `npm deprecate` themselves. This is a known gap, not an oversight.
- The version-field discrepancy (`2.3.5` local vs. `2.4.0` published) is
  explained (an orphaned out-of-band publish predating or bypassing this
  repo's history — see above) but not "fixed": the local field is left as-is
  rather than bumped to match a publish this repo's history never produced.

## ADR-015

**The Dashboard is a Distinct Actual-Play Surface, Separate from Live Sheets**

### Status

**Superseded by [ADR-038](#adr-038)** (2026-10-08), which restates the
decisions of this one that stand: the separate surface sharing the sheets'
state, the reused SRD display, the flat-and-inset treatment and the fixed
canvas. Its rotary Dial and ephemeral play state were replaced there.

Full text: `git show bc9f08ce:docs/ARCHITECTURE.md` (its `## ADR-015` section)

## ADR-016

**The Rotary Dial Selector and the Instrument / Reference Split**

### Status

Merged into [ADR-015](#adr-015) as its decision 1. **Superseded by
[ADR-038](#adr-038)**: Major and Minor slots replace the Dial.

Full text: `git show c2476d1c:docs/adrs/ADR-016-dashboard-rotary-dial-instrument-split.md`

## ADR-017

**Reuse the Faithful Light SRD Display; Instruments Are Bespoke**

### Status

Merged into [ADR-015](#adr-015) as its decision 2. **Superseded by
[ADR-038](#adr-038)**, whose §7 restates it.

Full text: `git show c2476d1c:docs/adrs/ADR-017-dashboard-reuse-faithful-srd-display.md`

## ADR-018

**Instrument / Viewfinder Aesthetic — Flat & Inset, Only the Display Reads Forward**

### Status

Merged into [ADR-015](#adr-015) as its decision 3. **Superseded by
[ADR-038](#adr-038)**, whose §8 restates it.

Full text: `git show c2476d1c:docs/adrs/ADR-018-dashboard-instrument-viewfinder-aesthetic.md`

## ADR-019

**Dashboard Play-State & Prefs Are Ephemeral / Local-First, Under the ADR-007 Boundary**

### Status

Merged into [ADR-015](#adr-015) as its decision 4. **Superseded by
[ADR-038](#adr-038)**: play state is a per-pilot seat saved on the Game
(§2), and mount still never reaches a pilot or mech record.

Full text: `git show c2476d1c:docs/adrs/ADR-019-dashboard-play-state-ephemeral.md`

## ADR-020

**Fixed 1280×800 Scale-to-Fit Canvas with a Phone-Reflow Floor**

### Status

Merged into [ADR-015](#adr-015) as its decision 5. **Superseded by
[ADR-038](#adr-038)**, whose §9 restates it.

Full text: `git show c2476d1c:docs/adrs/ADR-020-dashboard-fixed-canvas-scale-to-fit.md`

## ADR-021

**ITUN Surface Taxonomy — Enforcement Modes & Rule Placement**

### Status

**Accepted — governing ADR.** This is the top-level decision for how ITUN treats
game rules. **Where it conflicts with any prior ADR, this ADR wins** (scope and
the specific overrides are listed under [Supersession](#supersession--precedence)).

"Accepted" records the **decision**; the code has since largely caught up (the
Wizard enforces Guided Creation hard on the create path, the Dashboard ships at
`/dashboard/$pilotId`, and ADR-022's Change Log is live). The living, authoritative
placement table is the matrix in
[rules and ITUN surfaces](#rules-and-itun-surfaces) — keep
placements in sync **there**, not by re-editing the summary below. This ADR
records _why_ the taxonomy exists; the arch doc records _what goes where_.

### Context

ITUN grew a set of distinct surfaces — a roster, build wizards, the live sheet, an
encounter tray, snapshot publish/view. Our rules docs described "the app" as one
actor that enforces "economic" rules and defers "procedural" ones. The code never
matched that flatness: the _same_ constraint is a gentle advisory while you build
a character (`PilotWizard.tsx:96–97`, "never blocking") and a hard block while you
play one (`SheetMech.tsx:71–76`, Push disabled at the Heat Capacity). Enforcement
is not a property of the rule; it is a property of **what the player is doing**.

The design intent, stated by the owner, is sharper than "economic vs procedural":

- The **Live Sheet** is a _free_ surface — the gooey sticky middle for patching
  reality when a human moment at the table needs it. It must **not** enforce
  lifecycle events. Add a system without spending Scrap; add an ability without
  spending TP; set health, Scrap, and conditions freely; override caps and maxima.
  It edits **state**, not **events**.
- The **Wizard** and the **Dashboard** (the live Pilot + Mech + Crawler play
  surface) are the _guided_ surfaces with hardcore rules enforcement — guardrails
  and automatic layers that act _for_ the player and **teach the rules as they
  enforce them** (each Dashboard layer, Downtime being the template, exposes its
  rules inline). Every lifecycle transaction — use a system (take its Action,
  spending EP/Heat), Push, craft, salvage, repair, upgrade, Downtime, spend earned
  TP — belongs to these guided surfaces.

So the Live Sheet is the **least-enforced** surface in the app, and the guided
surfaces are the enforced bookends. A flat "the app enforces X" framing gets this
exactly backwards for the Live Sheet.

### Decision

**ITUN surfaces are classified by enforcement _mode_, and a rule's enforcement is
a function of the mode, not of the rule alone.** The border between modes is the
**lifecycle transaction** — a state change the rules gate behind a cost or
procedure.

**Modes** (a surface _hosts_ a mode; the mode names are ours, not Salvage Union's):

| Mode                | Surface(s)                                   | Stance                                                               |
| ------------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| **Guided Creation** | Wizard                                       | Enforce creation rules; a how-to guide for making a legal entity.    |
| **Free Edit**       | Live Sheet                                   | No lifecycle enforcement. Edit end-state directly; override caps.    |
| **Guided Play**     | **Dashboard** (Pilot + Mech + Crawler, live) | Enforce play; interactive rules-layers that teach as they enforce.   |
| **Frozen**          | Share / View                                 | Read-only snapshot.                                                  |
| **Adjudicate**      | Encounter (→ future Mediator layer)          | Mediator tooling; surfaces rules, enforces nothing on player sheets. |

**Rule placement** (full matrix in
[rules and ITUN surfaces](#rules-and-itun-surfaces)):

- **Lifecycle transactions** (use a system → EP/Heat/uses, Push, Scrap/TP costs,
  Downtime, craft, salvage, repair, upgrade, advancement) — **enforced +
  interactive in the guided modes; bypassed in Free Edit** (edit the end-state, no
  cost). Using a system is a **Dashboard** act, never a Live-Sheet one; the Live
  Sheet may still hand-edit a remaining-uses _count_ (free state).
- **Structural coherence** (refs resolve, type/containment) — **hard in every
  mode**, Free Edit included. House-ruled objects allowed; incoherent ones not.
  (This covers house-ruled arrangements of _existing_ content; authoring net-new
  homebrew content is out of scope — see Consequences.)
- **Quantitative caps** (slot counts, derived maxima) — derived in guided modes,
  **overridable in Free Edit** with a callout and a retained baseline (ADR-022).
- **Free state** (HP/SP/Heat/EP/AP/Scrap, conditions, uses) — **freely editable in
  Free Edit**; moved only via enforced actions in Guided Play. (Applying
  Mediator-declared damage splits: the SP→HP overflow rule runs as a Dashboard
  transaction; raw-setting SP/HP is a Free-Edit edit.)
- **Procedural adjudication** — surfaced, never enforced (unchanged); the
  Adjudicate mode tools it GM-side, player surfaces only apply the outcomes.

**Classify both axes before building.** Any rules feature is placed on a mode (→
enforcement stance) _and_ a rule class (→ what the stance does); the matrix cell is
the behavior.

**The Dashboard is a separate, multi-entity surface — built.** It composes a
player's Pilot + Mech + Crawler into one live play surface (distinct from the
single-entity Live Sheet), shipped at `/dashboard/$pilotId`
(`src/components/dashboard/`). The code rename from the working title "Play
Cockpit" has landed, and the Live Sheet's leftover play control (`QuickRollFab`)
is gone. Detail in the architecture doc.

### Supersession / precedence

This ADR is the top of the stack for **rules enforcement and surface behavior**.
Concretely it overrides:

- The enforcement framing of the former _Rules Engine Boundary_ doc — rewritten as
  [rules and ITUN surfaces](#rules-and-itun-surfaces) around
  this model.
- Any assumption that ITUN has a single, app-wide enforcement stance. Enforcement
  is per-mode.
- The **Wizard's** former soft-warn-never-block behavior: the create path is now
  enforced Guided Creation (soft → hard; edit mode keeps the soft regime).
- The **Live Sheet** hosting enforced play controls: Push, Heat Check, and using a
  system ([ADR-008](#adr-008)'s `activateItem`) relocate to
  the Dashboard; the Live Sheet becomes pure Free Edit plus overrides.

Prior ADRs on **orthogonal concerns remain in force on their own subjects** —
[ADR-001](#adr-001) (the local-first foundation this rests
on), [ADR-002](#adr-002)/[ADR-003](#adr-003)
(persistence), [ADR-004](#adr-004) (snapshots),
[ADR-005](#adr-005)/[ADR-006](#adr-006)
(data & rules math), [ADR-011](#adr-011)–[ADR-014](#adr-014)
(infra). This ADR only takes precedence where a prior decision speaks to _how hard
a rule is enforced on which surface_:

- [ADR-007](#adr-007) (automation boundary) is **retained and
  scoped under** this ADR: confirm-before-destructive governs **Guided Play**; in
  **Free Edit** the player edits conditions by hand, which ADR-007 already permits
  (it forbids _automatic_ mutation, not deliberate editing).
- [ADR-010](#adr-010) (persistence-agnostic
  choices) is consistent: Frozen is its read-only end.

### Consequences

- The Live Sheet is intentionally the least-enforced surface. Wanting a Live-Sheet
  _hard block_ (beyond structural coherence) is a proposal to change this ADR, not
  a bug.
- Unwired rules primitives (`salvage`, `crafting`, `downtime`, `scrapMech`,
  `takeDamage`) have a defined destination: Dashboard layers, enforced + interactive.
- When the Dashboard splits out from the Sheet it inherits Guided Play with no
  reclassification — the taxonomy already accounts for it.
- The provenance log and stat-override model that this surface split requires are
  decided separately in [ADR-022](#adr-022).
- The **Dashboard** (Guided Play) surface has its own design in
  [ADR-038](#adr-038), with the full design in
  [dashboard.md](architecture/dashboard.md). It instantiates this taxonomy; it
  does not compete with it (ADR-038 §6 is the Guided-Play surface and obeys the
  ADR-007 boundary this ADR scopes; §2 is its play state).
- **Long-tail, out of scope** (all gated on revisiting
  [ADR-001](#adr-001), and none alter this taxonomy):
  - **Shared, live Dashboard** — several players on one Dashboard at once,
    synchronized with a Mediator live. The single-player Dashboard is the first step
    toward it. **Partly delivered by [ADR-038](#adr-038):** each pilot's play
    state is saved on the Game and visible to the crew live, though each player
    still has their own screen.
  - **Workspaces → "Game spaces"** — shared spaces with entities owned by you vs.
    by others; ownership scopes _who_ may edit, not _what_ each mode enforces.
  - **A dedicated Mediator layer** — the Adjudicate mode moves off Encounter into
    a GM-facing surface (the Guided Play → Dashboard move applied to the GM side).
    The mode already exists here, so the move needs no reclassification.
  - **Net-new homebrew content authoring** — a path to author systems/abilities
    absent from the dataset, which Free Edit cannot express (an unresolved ref is
    incoherent). A future authoring surface feeding the dataset, not a Free-Edit
    affordance.

## ADR-022

**Per-Entity Change Log (Provenance) & Stat Overrides**

### Status

Accepted — **built**: the Convex `changeLog` table (`apps/itun/convex/changeLog.ts`)
is written at the `entityStore.update` chokepoint (`commitChangeLog`) and read
through `ChangeLogDrawer` (`changeLog.forEntity`) behind the sheet menu; Live-Sheet
cap overrides ship with the derived-baseline callout and revert.

**Amended by [ADR-030](#adr-030) and [ADR-034](#adr-034)** — the log is
account data on Convex, synchronized by the client on every write, not a
device-local record.

**Amended 2026-10 (#1130)** — the table is the log's only copy; IndexedDB v18
drops the device store this ADR first built. Replay/time-travel
is still unbuilt. Subordinate to
[ADR-021](#adr-021), which establishes the surface/mode
model this ADR serves.

**Amended 2026-07** — an override is now an **absolute pin**, not a signed delta
in the same field the rules derivation reads. See
[Amendment](#amendment-2026-07-overrides-become-absolute-pins); the amendment is a
hard prerequisite for
[ADR-029](#adr-029).

**Amended 2026-10** — a pin equal to its derivation is not an override, and the
breakdown's `overridden` flag is the only thing any surface reads. See
[Zero-delta pins](#amendment-2026-10-a-zero-delta-pin-is-not-an-override).

### Context

[ADR-021](#adr-021) makes the **Live Sheet** a Free-Edit
surface: players may override caps, bypass lifecycle costs, and hand-edit state to
patch reality at the table. Two capabilities fall out of that decision and need
their own record:

1. **Overrides must be distinguishable from derived values.** If a player pins max
   SP above its computed value, the sheet has to show that the number is an
   override, not a derivation — and ideally let them revert.
2. **Manual edits need provenance.** The whole point of Free Edit is off-rules
   change. Six months later, "why does this mech have 4 extra cargo?" must be
   answerable. Enforced Dashboard transactions deserve the same trail. Without a log,
   the free surface becomes an un-auditable one.

Both touch the IndexedDB persistence layer
([ADR-002](#adr-002),
[ADR-003](#adr-003)) and are event-sourcing-shaped, so they
are a distinct decision from the surface taxonomy.

### Decision

#### Change Log (the provenance log)

The player-facing name for the provenance log is the **Change Log**.

**Every mutation to a player entity, on every surface, appends to a per-entity,
append-only Change Log** — _all_ changes, not just overrides. Both classes are
recorded, each tagged with its provenance:

- **Transaction** entries — enforced lifecycle events from Guided Creation / Guided
  Play (`spent 3 scrap to install Coilgun`, `Push: +2 heat, Heat Check → 14`).
- **Override / manual** entries — free edits from the Live Sheet
  (`manual override: currentHeat → 0`, `cap override: maxSP 12 → 16`,
  `installed Coilgun (no cost)`).

Properties:

- **Append-only and ordered** — entries are never mutated or deleted in place; the
  log is the entity's history, not a cache.
- **Emitted at one chokepoint** — the entry is written where all persistence
  already funnels: the `entityStore.update` write-through
  ([ADR-003](#adr-003)). "Every mutation is logged" then holds
  by construction, not by remembering to log at each call site; a surface that
  mutates an entity outside the store is the visible anti-pattern, not a silent gap.
- **Replay-shaped, replay-deferred** — entries carry enough structure
  (target field, before/after, provenance kind, source surface) to _reconstruct_
  state by replay. A player-facing replay / time-travel surface is **explicitly out
  of scope for now** — we build the log so replay is _possible_, not the replay UI.
- **Local only** — the log lives in IndexedDB and **does not travel with a
  published snapshot**. A snapshot stays a frozen, historyless, bare-entity payload
  ([ADR-004](#adr-004),
  [ADR-010](#adr-010)). Provenance is a
  local-first, owner-only concern; it is not part of the share contract.
- **Viewed behind a menu, never inline** — the Change Log is reached from a menu
  (a "Change Log" drawer / item), **not rendered in the Live Sheet body**. The
  sheet shows current state; the full history lives one tap away. This keeps the
  free surface clean while still auditable.

#### Stat overrides

**An overridden stat retains its derived baseline.** A cap/maximum override stores
both the pinned value and the value it would derive to, so the UI can render an
"overridden from N" callout and offer a one-click revert to derived. Overrides are
therefore **non-destructive and reversible**: reverting drops the pin and the stat
resumes tracking its derivation.

- **An override is an absolute pin, not a delta** (amended 2026-07 — see
  [Amendment](#amendment-2026-07-overrides-become-absolute-pins)). The stored value is
  the pinned maximum itself; the derived baseline is recomputed live and never
  persisted.
- The override marker is a small, visible graphical indicator on the affected stat
  — enough to tell an overridden value from a derived one at a glance. It appears
  **on the Live Sheet only**; a published snapshot renders the value plainly (a
  frozen view has no revert —
  [ADR-010](#adr-010)). This inline indicator
  is distinct from the Change Log above: the indicator flags a _currently_
  overridden stat on the sheet; the Change Log (behind a menu) records _all_
  changes over time.
- Overrides apply to quantitative caps and maxima (per ADR-021). Structural
  coherence is never overridable; free state needs no override concept (it is
  already free).

### Consequences

- The Live Sheet's freedom becomes auditable rather than opaque — the audit trail
  is strongest exactly where the app stops enforcing.
- Overrides are safe to make: nothing is lost, the derived baseline is always
  recoverable, and the sheet never silently hides that a number was pinned by hand.
- New cost: schema + migration work in `src/lib/db/` (an append-only log store and
  an override representation on entity records). Routing the log entry through the
  `entityStore.update` chokepoint ([ADR-003](#adr-003)) keeps
  "every mutation is logged" structural rather than a per-call-site discipline —
  the requirement lives in one place instead of scattered across components.
- Replay is preserved as a future option at low present cost — the log is designed
  for it even though no replay surface ships now.
- Snapshot payloads and their privacy surface are unchanged: history stays local.

### Amendment (2026-07): overrides become absolute pins

#### What was wrong

As built, an override is stored as a **signed delta** in the same field the rules
derivation reads — `maxSpModifier`, `maxHpModifier`, `maxApModifier`,
`maxEpModifier`, `maxHeatModifier`, `maxCargoModifier` — and the "derived
baseline" this ADR requires is recovered by **subtracting it back out**:

```ts
const derivedMaxSP = maxSP - (mech.maxSpModifier ?? 0) // MechSheet.tsx
```

So one field carries two incompatible meanings: the Free-Edit override pin _and_
the only channel through which any rules modifier reaches a maximum today (which
is why hand-entering Beefcake works at all, and why the Eldridge Coast pregens
write these fields directly).

The consequence is blocking. The moment a contribution applies automatically
([ADR-029](#adr-029)), it must not be
written there — or a **rules-legal bonus renders as a hand override**, complete
with an "overridden from N" callout and an offer to revert it. The sheet would
actively lie. No data backfill can proceed until this is separated.

#### The amendment

1. **An override stores the pinned value absolutely** (`max*Override`), not a
   delta. The derived baseline is recomputed live from contributions and is never
   persisted — which is closer to what this ADR always specified ("stores both the
   pinned value and the value it would derive to") than the delta ever was.
2. **`overridden` becomes an explicit flag**, not an inference. `VitalGauge` must
   not decide whether a value was pinned by comparing two numbers.
3. **Rules modifiers are never persisted on the entity.** They are derived
   contributions, resolved at read time.
4. **An override appends to the breakdown; it never replaces it.** The provenance
   panel shows every derived contribution, subtotals them, and applies the pin as
   the final line. This makes the retained baseline _visible_ rather than merely
   stored, and makes the revert self-explanatory: the player can see the number it
   falls back to and why that number is what it is.

#### Migration — none required

Existing `max*Modifier` values are an unrecoverable mixture of hand overrides and
rules bonuses players typed in manually because the app would not apply them. A
migration cannot distinguish the two.

The original plan was to convert every existing value into an absolute pin. Two
findings during implementation ruled that out, and revealed a better option:

1. **A migration cannot compute a pin.** Turning a delta into an absolute value
   needs each record's full derived total — chassis `structurePoints`, the
   installed `statBonus` sum, tech-level base, injury penalties. A migration may
   only await IndexedDB operations on its versionchange transaction; awaiting
   reference data lets the transaction auto-commit mid-migration (see the header
   of `8-crawler-battle-sp-to-derived.ts`, which hardcodes frozen snapshots for
   exactly this reason). Deferring the conversion to hydration instead would make
   the result depend on _when_ the user next opened the app — a player who
   upgraded across the contribution work would have their hand-entered bonus
   converted against a derivation that already included the real one.
2. **A pin stops tracking derivation — that is what a pin is for.** Converting
   every legacy modifier into a pin would freeze that maximum permanently. The
   affected population is precisely the players who hand-entered Beefcake because
   the app would not apply it; they would be the ones whose sheets then _ignored_
   Beefcake once it became a real contribution.

**Decision: split the two meanings into two fields and migrate nothing.**

- `max*Modifier` keeps its stored values and its current arithmetic, and is
  re-documented as what it has always actually been: a **manual adjustment**
  that contributes to the derived total.
- `max*Override` is the new **absolute pin**, written only by the Live Sheet's
  override control from this point on.

This is lossless by construction — not one stored byte changes and not one
displayed number moves — and it needs no migration, no hydration pass, and no
version-skew reasoning. The legacy adjustment keeps composing with future
contributions instead of freezing them out, and once the provenance panel lands
it appears as its own labelled line (`Manual adjustment +6`), so a hand-entered
bonus that duplicates a real one becomes **visible and removable** rather than
silently doubled.

The five Eldridge Coast pregens are the unambiguous case in the other direction:
those are **authored content**, not player overrides, and become real
contributions rather than manual adjustments. `eldridgeCoast.ts` said so in its
own header (that seed module was deleted in
[ADR-030](#adr-030) Phase 0; the quotation is
preserved from git history because the argument still stands) — "class/ability bonuses ... are encoded via `maxHpModifier` /
`maxApModifier`" — which is precisely the conflation this amendment removes.
`pilotInventory.ts` carries the same admission for the third field ("base 6 +
`maxInventorySlotsModifier` (Beefcake +4)"), a bonus no UI can even write today.

#### Also fixed alongside

Three gaps in this ADR's own "every mutation is logged" guarantee, all found by
inspection and none of them behavioural changes to the log's design:

- `kind: 'transaction'` is defined in the schema, documented at
  `entityStore.ts`, and badged in `ChangeLogDrawer` — but **emitted nowhere**. Every
  Dashboard lifecycle transaction currently logs as a manual edit.
- `source` is **never passed** by any call site; every persisted entry reads
  `'unknown'`.
- `entityStore.transfer()` performs cross-entity writes and **never calls
  `emitChangeLog`**, so cargo stow/load and scrap hand-offs leave no trace. This is
  the one true hole in the chokepoint guarantee.

### Amendment (2026-10): a zero-delta pin is not an override

#### What was wrong

Item 2 of the 2026-07 amendment — `overridden` is an explicit flag, and
`VitalGauge` must not decide it by comparing two numbers — was never applied to
the gauge. Two definitions of "overridden" shipped side by side: the breakdown
said "a pin is stored" (`typeof override === 'number'`), while `VitalGauge`
said "the caller's baseline differs from `max`". They disagree exactly when a
stored pin equals its derivation, which is what happens when upgrades catch up
with a pin (Stat Training from a higher-tier crawler, Bionic Arms, …):

- the ledger showed `Derived 14 / Override 14 — pinned by hand`, while the gauge
  showed a plain numeral with no `*` and no ↺;
- the pin could not be removed — no ↺, and the gauge swallowed a commit of the
  number already shown — so typing the derived value back in did nothing;
- the stored pin stopped tracking derivation, and the next change (another
  upgrade, a lower-tier crawler) brought it back as a rust override the player
  believed they had deleted.

#### The amendment

1. **A pin that adds +0 is not a modification** — the player's rule: "If a
   bonus would provide +0, nullify it for the purposes of modification." The
   breakdown's `overridden` is true only when a stored pin differs from what the
   rules derive right now (both floored at 0, as displayed). When it is false,
   `total` is the derived value and the ledger has no Derived/Override lines.
2. **One flag, read everywhere.** `VitalGauge` takes the breakdown and reads
   `overridden` — the `--tone-deep` numeral, the `*`, the ↺, the "overridden
   from N" caption and the ledger all follow it, on the Live Sheets and the
   Dashboard dials alike, so they cannot disagree. ↺ is offered whenever the
   value renders as overridden.
3. **Never written.** The write path normalises with the same predicate
   (`pinFor` in `lib/rules/derivedStats.ts`): typing the derived value stores no
   pin, and clears one that is stored. The gauge reports every committed max so
   this works even when the pin already reads as derived; the sheet skips a
   write that would change nothing.
4. **A pin the upgrades caught up with stays stored, and dormant.** It is still
   the player's absolute pin — nothing writes it away behind their back, from a
   render or from another surface — but while it adds +0 it reads exactly like
   the derived value. If the derivation later moves past it, it is a modification
   again: flagged, explained, and one ↺ away from tracking the rules. Removing a
   pin is always an explicit act (↺, or typing the derived value), and whether a
   number reads as modified is a pure function of the stored pin and the current
   derivation, identical on every surface.

#### Also fixed alongside

The crawler's ↺ never reached the server. A crawler write is a field patch
merged on the server (ADR-030 §5), and the Convex client drops `undefined`
object fields when it serialises the args, so `{ maxSpOverride: undefined }`
arrived as `{}` and the pin survived — to return the next time the row was
pulled. `patchCrawlerByAppId` now takes `unset: string[]`, the names of cleared
fields, each checked against the crawler schema; the client derives it from the
patch's undefined keys. Pilots and mechs were unaffected: they send the whole
body, so a cleared key is simply absent from it.

## ADR-023

**Drone/Companion Equipment Hosts an Installed Systems/Modules Loadout**

### Status

**Superseded by [ADR-027](#adr-027)**, itself
superseded by [ADR-028](#adr-028). The slug-keyed
`equipmentLoadouts` this recorded became per-instance partners on both the
pilot and the mech.

Full text: `git show c2476d1c:docs/adrs/ADR-023-drone-equipment-installed-loadout.md`

## ADR-024

**Derived, Per-App Release Changelogs for the Sites**

### Status

**Superseded by [ADR-041](#adr-041)** (2026-10-08). Each site's changelog is
still derived from conventional squash titles, but read from `main`'s history
at build time and filtered by scope; release-please, its versions, its release
PRs and the `CHANGELOG.md` files are gone.

Full text: `git show bc9f08ce:docs/ARCHITECTURE.md` (its `## ADR-024` section)

## ADR-025

**Versioned Internal Releases + Public-Surface Gate for `salvageunion-reference`**

### Status

**Superseded by [ADR-040](#adr-040)** (2026-10-08). The reference package has no
release stream: no version, no `CHANGELOG.md`, no release-please component. Its
API-report half had already been withdrawn (2026-09-28); the JSON-schema drift
check it relied on is `bun run check generated`, which predates it.

Full text: `git show bc9f08ce:docs/ARCHITECTURE.md` (its `## ADR-025` section)

## ADR-026

**Entity Card Design Rules (the single reference-entity renderer)**

### Status

Accepted.

### Context

The reference-entity display was reconciled from a 57-file legacy render core
(`ReferenceEntityDisplay/`, "RED") onto a single card. That migration
(its methodology is now the `/component-refresh` skill,
[`.claude/skills/component-refresh/SKILL.md`](../.claude/skills/component-refresh/SKILL.md))
settled a set of **design rules** along the way — about how choices render, how
stats read, how tech-level scaling looks, and which data carries a tech level.
Those rules were decided interactively and proven in the story catalog, but were only
recorded in commit messages. This ADR enshrines them so they are not
re-litigated, and points at the stories that demonstrate each.

See also: [ADR-010](#adr-010) (choices
ephemeral vs persisted), [ADR-021](#adr-021) (surface/mode
taxonomy — which surface may enforce vs. free-edit), [ADR-023](#adr-023)
(drone loadout).

### Decision

#### 1. One renderer — `ReferenceEntityCard`, and nothing else

`ReferenceEntityCard` (`components/referenceEntity/card/`) is the **only**
reference-entity renderer, with no compat shim in front of it: size is `size`,
damage is `damaged`, and stat overrides are `StatItem[]`. Call the card.

#### 2. Entities always render as the card — layer UI on top

Never hand-assemble entity markup or replace the card to add app UI. Selection
halos, control buttons, status cycles, count-steppers, choice pickers, and the
tech-level stepper are **layered onto** the card (props / overlays), never a
substitute for it. (Universal rule; predates this ADR, restated here.)

#### 3. Choices interweave by data shape, not special cases

A `choice` **content-block marker** (`ContentBlock.choiceId`, schema in
`salvageunion-reference`) positions a choice inline in the body where it belongs;
the renderer walks content and drops the choice group at its marker. Prefer
changing the _data shape_ over special-casing the renderer.

**Choice placement splits by kind:**

- **Freeform choices** (`source.kind: 'text'`, or no `source` — a simple free-text field, e.g.
  a companion's Name / a crawler's Keepsake / Motto) are treated as **simple
  inputs**. In **read-only** they surface as **`Choose | <name>` sub-header cells**
  (a `Stat` hint that there's a field to fill), never a body block. In
  **editable** mode they stay in the body as a real text input (you type into it).
- **Multiple-choice choices** (`source.kind` is `table` / `options` / `catalog` /
  `systemVariant`, or `cardinality.max` is above one or `{ scalesWith }` —
  "choose from the list below") always render **inline in the body**, in both modes.

- **Read-only choices render SOLID** — every option at full strength (a static,
  readable list). The **dim-until-chosen** affordance is **editable-only**: an
  unchosen option is dimmed, the chosen option un-dims and gains a **"Chosen"
  stampseal** (no rust selection ring). Options are always a
  `button[aria-pressed]` so the chosen state stays queryable in both modes
  (read-only is inert).
- Demo: `Compositions/Reference Entity Write Layer` → **ChoiceEquipment**
  (multiple-choice) / **FreeformChoices** (freeform → sub-header).

#### 4. The stat atom has exactly two modes: Normal and Compact — and NO pips

A `Stat` in the card cluster is either **Normal** (the vertical value box,
full labels) or **Compact** (the horizontal `[label | value]` cell, shortform
labels). **Compact IS horizontal** — there is no separate "horizontal" mode/axis.
Editable stats grow a `+/-` stepper column in either mode.

**`Stat` has no pip mode.** The framed pip tracker and the condensed
pip-chip were retired: a value/max tracker is the plain value box (a fill bar is
`VitalGauge`), and the crawler-bay condition tally is its own **`BayStatus`**
primitive. Individual pips live only in `VitalGauge` / `BayStatus` — never inside
a stat cell.

- Demo: `Atoms/Stat` → **Anatomies** / **ValueBox**; `Atoms/Bay Status`.

#### 5. "Modified stats" — the rust language

A stat/trait cell that a **choice touched** (e.g. picking a Weapon Type adds the
Ballistic trait; a Modification sets Range → Far) OR that **tech-level scaling
changed** gets the **rust "modified" border** (`--color-rust`); an added trait
also gets a rust label ground. The value itself updates. This applies to
**statblocks / `Stat` cells only** — not `VitalGauge`.

- Demo: `Compositions/Reference Entity Write Layer` → **ChoiceEquipment** /
  **TechLevelScaling**.

#### 6. Effective / editable tech level drives scaling

Some granted, TL-scalable pilot equipment (e.g. Custom Sniper Rifle) resolves an
**effective tech level** that drives its Modification-choice cap
(`cardinality.max.scalesWith: techLevel`) AND any `perTechLevel` datavalue
(e.g. "+1 SP damage per Tech Level after the first").

- Effective TL = `max(baseTL, effectiveTechLevel ?? scalingParent.techLevel ??
baseTL)` — it **floors at the entity's base TL** (a granted item is never below
  its own tech level; so a TL1 item with no crawler shows `0/1`, not unbounded).
- **Both contexts are supported** (a card may use either or both):
  **controlled from without** — pass `effectiveTechLevel` (the crawler level in
  ITUN, via `scalingParent`); the header TL reads it and Damage + cap reflect it,
  read-only. **Editable in place** — pass `onTechLevelChange`; the header "TL" cell
  becomes an editable `+/-` stepper.
- Damage scaling is resolved by `resolveDataValueForTechLevel` and surfaced with
  the rust "modified" border (rule 5).
- Demo: `Compositions/Reference Entity Write Layer` → **TechLevelScaling**.

#### 7. Data rule: granted-only pilot equipment is TL1

Equipment that exists **solely to be granted** by an ability and has **no
standalone existence / no inherent rules tech level** (created by the ability —
"that only you can use" / "you have constructed…") is modeled at **TL1**. Its
granting ability's tier is not its tech level. Equipment that exists of its own
accord with a rules-based standalone tech level keeps that tech level. (Applied to
Custom Sniper Rifle, Holo Companion, Mecha Companion; the other grant-only pilot
equipment was already TL1.)

### Consequences

- The design rules are demonstrable and regression-guarded: each has a story
  (canonical groups `Compositions/Reference Entity *` and `Atoms/Stat`),
  and the story-coverage guard keeps every barrel-exported visual component
  storied.
- Rule 7 is a shared-data change: it changes the tech-level badge on srd /
  the Discord bot as well as ITUN. It is a data ruling, not a computed value —
  future granted-only equipment should be authored at TL1 directly.

## ADR-027

**Partners Are Instances Owned by a Pilot or a Mech**

### Status

**Superseded by [ADR-028](#adr-028)**, which keeps
this record's partner model (restated there under "The model") and removes its
surface. Supersedes [ADR-023](#adr-023).

Full text: `git show c2476d1c:docs/adrs/ADR-027-partners-owned-by-host.md`

## ADR-028

**A Partner Renders In Place, As The Reference Entity It Already Is**

### Status

Accepted. Supersedes [ADR-027](#adr-027), whose
**model** it keeps in full (restated below) and whose **surface** it removes.

### The model (kept from ADR-027)

A partner is a granted thing that uses the mech rules without being a mech —
Auto-Turret, Survey Drone, Mecha Companion, Sestra Drone. It is a
**`PartnerInstance` owned by its host**: an additive-optional
`partners: PartnerInstance[]` on both `PilotSchema` and `MechSchema`.

- **One shape, two grant paths.** `hostSchema: 'equipment' | 'drones'` selects
  which reference file `hostRef` resolves against. "Survey Drone" is a record in
  both files, so resolving without it picks the wrong one.
- **Every instance carries its own `id`**, which is what lets Mecha Packmaster
  field two companions and Big Brother four drones.
- **Ownership is intrinsic, not a soft link.** Deleting a host removes its
  partners, and they ride through snapshots and export bundles with it.
- **Tech level is derived, never stored** (`partnerTechLevel`). Pilot-granted
  partners take the Union Crawler's tech level (Mecha Companion floored at
  Tech 3); mech-granted drones are fixed by their stat block.
  `techLevelOverride` is a Free-Edit escape hatch only (ADR-021).
- **Per-host caps are displayed, never enforced** (ADR-007).
- **A partner is a cargo carrier.** `cargoTransfer` speaks carrier/depot rather
  than mech/crawler; carrier→carrier handoff is not built.
- **`EntityRef` is not widened.** A partner is never either end of a soft link.

### Context

ADR-027 established the model above. What it got wrong was the surface. It gave a partner a dedicated live sheet at
`/sheet/partner/:id`, and with it a sixth ontology hue, an `EntityRowType`, a
`BadgeTone`, a `SheetVariant`, an id-scan (`findPartner`), and a `SheetKind` that
had to be `EntityRef['type'] | 'partner'` because the vocabularies did not
otherwise meet. That is a large surface for a thing the same ADR describes as
having "no independent existence" and being "not a roster citizen".

Two facts make the sheet the wrong shape:

- **A partner is already a reference entity.** It is an `equipment` record or a
  `drones` record. `ReferenceEntityCard` renders exactly this today in the SRD:
  `titleOverride` puts the instance name over the stat block ("Shield Drone"
  over Big Brother Drone) and `droneLoadout` renders its systems and modules as
  listings _inside_ the card. The read-only half of what a partner sheet did
  already existed, in the shared library, for the same entities.
- **A separate sheet moves the partner away from the thing that grants it.** On
  the pilot sheet, `survey-drone` sat in the equipment list as an inert card
  while the actual drone lived behind a link in the Linked Units rail — the
  grant and the granted thing rendered as two unrelated objects in two regions.

### Decision

**A partner renders in place, on its host's sheet, as an ordinary
`ReferenceEntityCard` decorated with its instance state.** There is no partner
sheet and no partner route.

- **The card is not a new component in any meaningful sense.** `PartnerCard` is
  props assembly over `ReferenceEntityCard`, using seams that already existed:
  `titleOverride` for the instance name, `statsOverride` for SP/EP/Heat (a
  `StatItem` carrying an `onChange` renders as an editable +/- cell, so the
  card's own stat axis is the vitals editor), `controls` for the advisory cap
  badge, and `afterExtraContent` for the identity fields, the Hold,
  and the installed systems/modules. No new visual language was invented.
- **Capability is preserved, not reduced.** Everything the live sheet did — name
  / A.I. personality / appearance, SP/EP/Heat, derived tech level and slot
  counts, the cargo hold, per-item conditions, uses and repair — the card does.
  The sheet is gone; nothing it could do is.
- **It renders where the grant is.** A pilot-granted partner renders **in place
  of** its granting equipment card in the Inventory section: the slug and the
  instance are one thing to the player, so they are one card. A chassis-granted
  drone gets its own `Partners` region in the mech body — part of the mech's own
  kit, not a linked roster entity.
- **Always full width, never a masonry cell.** A partner card carries a nested
  loadout and a cargo hold; a column crushes it. Callers render it outside their
  `MasonryColumns`.
- **Multiplicity falls out of it.** One card per `PartnerInstance` means Mecha
  Packmaster's two Mecha Companions are two cards over one equipment slug, with
  no special case.
- **The sixth ontology hue is deleted.** `--color-partner` existed because
  partner rows sat directly beneath a mech's linked units, where "reads like a
  mech" stopped being harmless. With the rows gone the rationale goes: a partner
  now renders in its native tone, equipment on a pilot and drone on a mech.
- **`DroneSchema` gains `bonusPerTechLevel`**, mirroring `EquipmentSchema`. The
  two files that can supply a player-facing companion now describe scaling the
  same way, so _absence_ of the field is the statement "this stat block is flat"
  — a fact in the data rather than one the consuming app knows from which file a
  record came out of.

### Consequences

- `SheetKind` is exactly `EntityRef['type']` again. The one place the two
  vocabularies met is gone, and `EntityRef` still never needed widening.
- `findPartner` is deleted. Nothing addresses a partner by a bare id any more —
  a partner renders where its host is already in hand — so the linear scan
  ADR-027 accepted as the price of intrinsic ownership turns out not to be a
  price at all. `replacePartner` remains: writes still go through the host.
- **Four surface concepts are removed** (`--color-partner`, `EntityRowType`'s
  `partner`, `BadgeTone`'s `partner`, `SheetVariant`'s `partner`), along with
  `SheetPartner`, `PartnerSheetPage`, `PartnerRows`, `partnerRailItems` and
  `partnerRoleLabel`.
- **A partner is no longer linkable.** ADR-027's sheet could be sent as a URL;
  now the only way to a partner is its host's sheet. This is the intended
  reading of "no independent existence", but it is a real capability that was
  briefly there and is now not.
- **`StatItem` is exported from `component-lib`.** It was already the element
  type of the public `statsOverride` prop, so a consumer could not name the type
  of a prop it had to pass.
- **The Auto-Turret's hold is structurally absent, still.** Cargo capacity 0 plus
  the Immobile trait means it is not a container with nothing in it — the Hold
  and the Cargo stat are both omitted rather than rendered as `0/0`.
- **Carrier→carrier handoff remains unbuilt**, exactly as ADR-027 left it.

### Amendment — the grant is the lifecycle

ADR-027 and this record both describe a partner as a thing that "cannot outlive
what grants it", and both were right about the model and silent about the
lifecycle. That silence was load-bearing: **nothing in the app ever created a
`PartnerInstance`.** The only writers were `removePartner` and the two v11/v12
migrations, so every partner in existence was a converted legacy record.
Building a Little Sestra dropped its Sestra Drone and a Big Brother on the
DronTek pattern dropped all four, which made the `Partners` region on the mech
sheet live code that could never render; equipping a pilot's Survey Drone
produced an inert equipment card with no structure, energy or loadout.

`apps/itun/src/lib/rules/partnerGrants.ts` closes it, and settles the lifecycle
question the earlier records left open:

- **A partner is a projection of its grant, in both directions.** It is created
  when the grant appears and destroyed when the grant goes — unequip the Survey
  Drone equipment and the drone goes with it; change a mech's chassis and its
  drones change with it. Reconciliation runs on the pilot sheet's equipment
  toggle and on both wizards' create paths.
- **There is therefore no standalone remove control**, and its absence is the
  point rather than an omission. A partner that could be dropped on its own
  would be unrecoverable, because nothing would ever grant it back. This is
  what replaces `removePartner` on both sheet action sets.
- **Both rosters are exact; only the source of the count differs.** A mech's
  count comes from its pattern. A pilot's comes from their **abilities**, with
  `pilot.equipment` acting only as the gate — it is a set, so it could never
  express "two Mecha Companions". Mecha Packmaster's `grants` already lists
  Mecha Companion **twice**, and it is the only ability in the dataset that
  grants the same thing more than once; reading it is what fields the second
  companion. The resolution is a **max** across the pilot's abilities, never a
  sum: the Ranger L1 ability grants one and Packmaster grants two, so a
  Legendary Ranger holding both would otherwise field three, which Packmaster's
  own text denies. Abilities are therefore a second lifecycle edge alongside
  equipment — taking Packmaster fields a companion, dropping it retires one.
- **Reconciliation never costs live state.** A surviving partner keeps its id,
  structure, energy, heat, conditions, name, appearance, A.I. personality and
  cargo. Re-seeding a drone's guns on a pattern change is correct; re-seeding
  its damage is data loss.
- **A drone's systems are the union of two sources.** Integrated hardware lives
  on the `drones` record (both player-facing drones carry a Hover Locomotion
  System); the fitted loadout lives on `pattern.drones[].systems`. A live drone
  needs both, which is a deliberate divergence from the SRD pattern card —
  that card is describing a pattern, not accounting for slots in play.
- **`partnerCap` is now derived, not hardcoded.** It used to string-match
  `mecha-packmaster`, which was both a hardcode and a duplicate of a fact
  already in the data — so the cap and the number actually seeded could drift
  apart. It now reads the same grant count, and a future ability granting two
  needs no code change. One hardcode survives on purpose: the Big Brother
  controls four drones (False Flag p. 62), which is a chassis ability's prose
  rather than a countable grant, and deriving it from "the most any pattern
  fields" would report 1 for a Custom build that is still allowed four.
- **Migration v15 makes the pilot invariant true.** Exact reconciliation means a
  pilot partner whose `hostRef` is absent from `pilot.equipment` answers to no
  grant and is reaped. v11 was careful about this ("the equipment slug stays in
  `pilot.equipment[]`"); **v12 was not** — it minted partners from companion-mech
  rows and never added the granting slug, which is precisely the case where the
  player had not equipped the item. Left alone, Eldridge Coast's Custos,
  Incitatus, PR-1 and Rek Jet would have disappeared on their pilot's next edit.
  v15 backfills the missing slug rather than deleting the partner: the partner is
  the evidence that something once granted it, so the honest repair is to restore
  the grant. It is append-only, so it is a no-op on a consistent database. The
  one real cost is that granting equipment occupies an inventory slot, so a
  healed pilot's usage rises by one and may read as over capacity — advisory
  only (ADR-007/021), and the true reading: under-reporting it was the bug.

## ADR-029

**Unified Contribution Model & Stat Provenance**

### Status

**Accepted** and implemented — the model lives in
`packages/salvageunion-reference/lib/rules/contributions.ts` and
`lib/schemas/objects/contributions.ts`. Subordinate to [ADR-021](#adr-021) (the
governing surface/mode taxonomy) and paired with the amendment to
[ADR-022](#adr-022) that makes a cap override an
absolute pin. Extends the "modified stats" rust language of
[ADR-026](#adr-026) from stat cells to prose.

**§4 is amended by [ADR-038](#adr-038)** (built): activated
effects resolve against the pilot's seat on the Game instead of ephemeral play
state. They are still never persisted on the entity.

### Context

Two problems were found together, and they share one cause.

**1. Content cannot declare what it does.** The dataset has _two_ mechanisms for
saying "this thing changes that number", and neither is reachable from an
ability:

|                  | Engine A                                                           | Engine B                                           |
| ---------------- | ------------------------------------------------------------------ | -------------------------------------------------- |
| Field            | `statBonus` (`MechStatBonusSchema`)                                | `effects` (`ChoiceEffectSchema`)                   |
| Vocabulary       | `structurePoints`, `energyPoints`, `heatCapacity`, `cargoCapacity` | `addTrait`, `removeTrait`, `setRange`, `addDamage` |
| Declared on      | systems, modules                                                   | `choices[].choiceOptions[]` only                   |
| Applied by       | `rules/derivedStats.ts`                                            | `resolveChoiceView.ts`                             |
| Records using it | 8                                                                  | a handful of choice-bearing granted equipment      |

`AbilitySchema` carries neither. So Beefcake ("Any Mech you Pilot increases its
Max Structure Points by 3+X … your Pilot increases their Max Hit Points by 2"),
Bionic Arms, Bionic Legs and Modular Face Implant are inert prose — the numbers
on the sheet are simply wrong for any pilot holding them. The content type most
likely to modify a character is the one type that can declare nothing.

A survey of the core book plus the three expansions found **23 records whose
text changes a maximum** (9 encoded, 5 stated-but-unapplied, 9 correctly
excluded) and a further **~21 that change a trait, damage value or range**.

One case is a plain defect rather than a schema gap: **Composite Armour** states
"increases your Mech's Max SP by 5 for each Composite Armour System you have
installed" — exactly the shape `statBonus.structurePoints` exists for — and
carries no `statBonus` at all.

**2. No derived value can explain itself.** Every maximum is computed as a flat
sum that returns a bare `number`, so nothing downstream can say _why_ it is that
number. The single exception is `crawlerMaxSPParts`, which returns
`{ base, typeBonus, modifier, total }` and is rendered on exactly one screen (the
crawler wizard, as "20 + 5 type bonus (Battle) = 25"). The shape to generalize
already exists and is already proven; it is used once.

These are one problem. A contribution that cannot be _declared_ also cannot be
_attributed_, and a value assembled from anonymous addends cannot be explained.

### Decision

#### 1. One contribution model

**A single vocabulary replaces both engines.** A contribution is a **source**, an
**operation**, and a **target** — regardless of whether the operation raises Max
SP, adds Burn 1, or bumps damage by 1.

```
Contribution {
  op        // the four cap keys, plus addTrait | removeTrait | setRange | addDamage
  target    // self | pilot | pilotedMech | crawler | <named item>
  amount    // an integer, or a small expression over tech level
  stacks    // per installed copy (the existing statBonus semantic)
  voidWhen  // damaged | destroyed — with the current-value clamp
  duration  // permanent (default) | activated (see §4)
}
```

**Any content type may declare contributions** — abilities, systems, modules,
crawler bays, crawler types, equipment. Ability parity is the point of the
exercise; a schema in which abilities are second-class is the bug.

**Do not fork the resolver.** `resolveChoiceView.ts` already applies
trait/damage/range correctly, including upgrading a duplicate trait's magnitude
(Explosive 1 → 2), and is already shared by srd and ITUN. This ADR widens where
effects may be **declared**; how they are **applied** is left alone.

**"Never infer a number from prose" survives.** The existing instruction on
`MechStatBonusSchema` is correct and is promoted to govern the whole model. The
remedy for an unencoded record is **authoring** the number where the text states
one flatly, or recording an explicit exemption — never inference. See §5.

#### 2. Derivations return parts, not numbers

Every derivation returns a breakdown generalizing the existing
`crawlerMaxSPParts` shape:

```
StatBreakdown { contributions: Contribution[], derived, total, overridden }
```

Each contribution carries a **label**, a **source kind**, a **signed amount**,
and — where it exists — a **ref** to the granting entity, so provenance UI can
link back to it. Existing scalar functions (`mechMaxSP`, `pilotMaxHP`, …) become
thin `.total` wrappers so no call site changes when this lands.

#### 3. Provenance is a property of the value, not of a surface

Any surface that renders a derived value can render its breakdown. Concretely:
Live Sheet, Dashboard, partner cards (rendered in place since #590), Frozen
snapshot, wizard previews, and entity reference cards.

- The panel opens on **hover, focus _and_ tap**. Hover alone is unreachable by
  keyboard and on touch, and is not acceptable.
- **Frozen** shows the breakdown and never the revert — a published snapshot has
  no editing affordance ([ADR-010](#adr-010)).
- **The Dashboard carries it.** `DashboardGauge` currently discards the
  override/breakdown props. Restoring them _is_ the "teach as they enforce"
  affordance [ADR-021](#adr-021) requires of Guided Play
  and the Dashboard presently lacks.
- **An override appends; it never replaces.** See the ADR-022 amendment.

#### 4. Duration-bound effects are Dashboard-applied, and never persisted on the entity

Some contributions are temporary: Squeeze It In (+4 Cargo, 12 hours, stacks with
itself), Hull Magnetiser (Cargo += the mech's System Slot Value, 1 hour,
toggleable).

These are **in scope as `duration: activated` contributions**, with two hard
constraints:

- They are **applied only by the Dashboard** (Guided Play). No other mode may
  switch one on — activating an effect is a lifecycle transaction.
- They resolve against the **pilot's seat on the Game**, never the persisted
  entity ([ADR-038](#adr-038) §2). Time does not enter the
  data layer; reference data declares _that_ an effect is activated and for how
  long, and play state records _when_.

The provenance panel shows them like any other contribution, annotated with
their remaining life ("Squeeze It In +4 — expires in 9h").

#### 5. The parity audit is the durable guarantee

A CI check scans every reference record whose text states a mechanical change —
a cap, a trait, a damage value, a range — and asserts **either** a structured
contribution **or** an explicit, reasoned exemption. Exemption classes, each
established by a real record:

| Class                     | Example                                                 | Why exempt                                                                             |
| ------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Chassis-integrated        | "Integrated Cargo Bay: +10, **to 16**"                  | Already the absolute chassis stat (Mule is 16). Encoding it double-counts.             |
| Current-pool effect       | Parasitic Membrane, Bite, Transfer                      | Moves or restores a current pool; reads a cap without changing it.                     |
| Already-modelled mechanic | Rad Wave Generator → Major Injuries                     | Handled by the existing injury penalty.                                                |
| Effect-of-an-effect       | Mender: "+4 SP each time you heal"                      | Modifies another effect's output, not a stat. Out of the model.                        |
| Grant at a moment         | Pilot Bay: "a **one-off** improvement of +2 HP / +1 AP" | A transaction, not a standing modifier. Encoding it as standing re-applies it forever. |

The audit is what makes "content denotes what it claims" **stay** true across
future content drops, rather than being a one-time sweep that silently rots. It
is the first thing built and the last thing removed.

#### 6. Rules-bearing prose is marked inline

On entity reference cards, the indicator that a contribution exists is rendered
**inline with the sentence that grants it**, not as a separate badge or footer
row. It extends the **rust "modified" language** already established by
[ADR-026](#adr-026) §5 for choice- and
scaling-touched stat cells, applying it to a prose span.

This is deliberate and does double duty:

- A reader sees _which clause_ the app actually understands, adjacent to the
  claim itself.
- Unmarked prose that plainly states a number becomes a **visible coverage gap in
  the product**, not only a CI failure. The parity backlog is legible to anyone
  reading a card.

Note ADR-026 §5 currently scopes the rust language to `Stat` cells and
explicitly not `VitalGauge`. This ADR does not change that; it adds a third
carrier (a prose span) alongside it.

### Consequences

- **Ability parity becomes possible at all.** Today it is not expressible, so no
  amount of data work fixes Beefcake.
- **One vocabulary, one provenance implementation.** The alternative — extending
  both engines separately — means two things to learn, two places to look when a
  number is wrong, and a third mechanism the first time someone needs an ability
  to grant a trait.
- **Ordering is forced.** The ADR-022 override amendment must land _before_ any
  automatic contribution, or a rules-legal bonus renders as a hand override. See
  that ADR for why.
- **The dataset gains authoring obligations.** Every future record stating a flat
  mechanical change must encode it or justify itself to the audit. This is the
  intended cost.
- **`resolveChoiceView` becomes load-bearing for more of the app**, which raises
  the value of its existing test coverage and the bar for changing it.
- Duration-bound effects introduce the first contributions whose value depends on
  play state rather than reference data alone. §4's constraints exist to stop
  that leaking into IndexedDB.

### Cross-references

- [ADR-021](#adr-021) — governing; which mode enforces what.
- [ADR-022](#adr-022) — the Change Log and stat
  overrides; amended by this work to make an override an absolute pin.
- [ADR-026](#adr-026) — entity card design rules; §5's
  rust "modified" language, extended here to prose.
- [ADR-038](#adr-038) §2 — the pilot's seat, the
  home of activated contributions.
- [ADR-006](#adr-006) — rules as pure functions; breakdowns
  stay pure and side-effect-free.
- [ADR-010](#adr-010) — the Frozen end of the
  display contract.
- [Rules and ITUN surfaces](#rules-and-itun-surfaces)
  — the authoritative mode × rule-class matrix.

## ADR-030

**Accounts, Games, and a Server of Record**

### Status

**Accepted and built — governing ADR for identity, ownership, and sharing.**

[ADR-034](#adr-034) **partially supersedes it**,
and the partial is the important word: §1 promises Solo mode — not signed in,
IndexedDB as the source of truth — "must keep working forever", and **that one
guarantee is withdrawn**. Persistence requires an account and IndexedDB is a
cache of Convex. Everything else here — Games,
memberships, roles, ownership, the two containers, Convex as server of record —
stands, so citing this ADR remains correct for all of it.

**Supersedes [ADR-001](#adr-001)** (local-first, no
backend, no auth). **Amends [ADR-022](#adr-022)**
(the Change Log is no longer local-only). Extends
[ADR-021](#adr-021) with an ownership axis without
altering any of its enforcement modes.

The operational reference (deployments, env vars, secrets, rotation) is
[accounts and Games operations](#accounts-and-games-operations) and the
`convex-ops` skill.

**2026-10-06 — the Games pages are folded into the Roster hub.** §6's surfaces
— the Games index (`/games`), a Game's crew page (`/games/:id`) and the
Mediator page (`/mediator/:id`) — are one place now: the hub at `/`, whose
"Showing" select lists My Stuff (the shelf) and every Game. A picked Game shows
its roster there, the viewer's own builds first, with the members' actions and
then the Mediator's instruments below the lists; "+ New game" starts or joins
one. The old URLs redirect (the two with an id pick that Game first). §6 is
otherwise unchanged: the Mediator keeps a surface of their own, as a section
only they see.

**§5 is amended by [ADR-032](#adr-032)**: a public read-only sheet is the one
exception to its visibility rules. **§5a is amended by [ADR-037](#adr-037)**: a
Game takes a player's crew before it has a crawler.

**§5 and §6 are amended by [ADR-038](#adr-038)** (built): only the table runner
edits a Game's crawler, and crew status reaches the Game-only Dashboard as a
Crew tab.

**Amended 2026-10 (#1130)** — §4: a proposal carries no before, only its value.

### Context

[ADR-001](#adr-001) made ITUN local-first with no
accounts and no application backend, and it closes with an explicit instruction:
do not reintroduce auth, server-side user storage, or realtime sync without a new
ADR superseding it. This is that ADR.

The decision is not a reversal of ADR-001's reasoning — it is a change in what
the product is for. ADR-001 correctly observed that _a player's pilots and mechs
are private working documents, not multiplayer state_. That is still true of a
person building a mech alone. It stopped being the whole story once the goal
became running **a table**: several players, one Union Crawler, a Mediator, and a
shared session where a Downtime happens to everybody at once.

[ADR-021](#adr-021) anticipated this precisely. Its
long-tail section lists **"Workspaces → Game spaces"**, a **"Shared, live
Dashboard"**, and a **"dedicated Mediator layer"** as out of scope and
_explicitly gated on revisiting ADR-001_. Nothing here is a surprise to the
architecture; this ADR opens the gate ADR-021 described.

Three existing decisions turned out to be well-shaped for this and are carried
over unchanged:

- **[ADR-004](#adr-004)** (immutable, unauthenticated
  snapshots) remains the account-free way to hand someone a pilot. It is untouched.
- **[ADR-027](#adr-027)/[ADR-028](#adr-028)**
  made partner ownership _intrinsic_ — partners ride their host through snapshots
  and export bundles with no orphan cleanup. That ports to per-user ownership with
  no change at all.
- **[ADR-022](#adr-022)**'s Change Log is already
  append-only, ordered, replay-shaped, and tagged with provenance and source
  surface. It becomes the spine of this feature (see _Amendment_ below).

### Decision

#### 1. Identity and the storage modes

ITUN gains **accounts, authenticated by Discord OAuth and nothing else**. Discord
is the only provider because the audience already lives there and the project
already ships a bot, which this makes a first-class authenticated client rather
than something needing its own credential story.

**Convex is the server of record.** A signed-in client reads through a reactive
subscription and writes to Convex; IndexedDB is demoted from source of truth to a
warm cache. Reactive subscriptions are the product feature here — synchronized
alerts and a live table are the point — not an add-on.

This produces **three modes**, and every surface must be legible in all three.
The current table — Solo is signed out and read-only, Connected writes to
Convex, Disconnected is a read-only cache — is [data flow](#data-flow) and
[`apps/itun/CLAUDE.md`](../apps/itun/CLAUDE.md). A **NOT CONNECTED** banner and
read-only state are the honest cost of choosing a server of record, and only a
signed-in user offline ever pays it.

Offline writes are **blocked, not queued**. An outbox would reintroduce conflict
resolution through the back door, which is the thing choosing a server of record
avoided. Revisit only with evidence from a real session, not in anticipation.

#### 2. Containers: Games and Shelves

A **Game** is the shared container — campaign, group, and the former Workspace
collapsed into one concept. There is no separate "group" that outlives a Game and
no separate "workspace" that sits beside one.

A **Shelf** is the second container: a per-account home for entities that are not
in play. It is deliberately _not_ a Game — a shelf has no Mediator, no invites,
and no crew — and it syncs, so drafts follow you across devices.

An entity is in exactly one container, encoded as two nullable columns:

| `gameId` | `ownerId` | State                                                  |
| -------- | --------- | ------------------------------------------------------ |
| set      | set       | claimed and in play                                    |
| set      | null      | **unclaimed** — awaiting assignment                    |
| null     | set       | on the owner's shelf                                   |
| null     | null      | **invalid** — must be unreachable through any mutation |

An entity belongs to **one Game at a time**, and moving it between containers is
a **change to `gameId`, not a copy**. There is one entity. A pilot on your shelf
and that same pilot in a Game are the same record with one field set
differently — never an original and a duplicate to be kept in step.

**Move and copy are different verbs, and the difference is the point.**

| Verb     | Result                                                                                                                             |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Move** | The **same** entity. Same id, same body, same history; only `gameId` changes. Nothing is duplicated and nothing needs reconciling.   |
| **Copy** | A **new** entity. New id, named `COPY OF <name>`, always `gameId: null`, and carrying no relationship to the source or to its Game. |

A copy is deliberate, explicit and user-initiated — "I want my own one of these"
— and once made it is simply a build of yours like any other. It does not track
its origin, does not sync with it, and does not follow it into or out of a Game.
That is what keeps copying safe: there is no ongoing relationship to get out of
step, which is exactly the property a fork would not have had.

So a character in somebody else's Game can be copied to your shelf without
copying the Game, and editing your copy can never touch theirs.

> **Amended 2026-08-06.** This clause previously read: _"a pilot's crawler
> level, scrap, TP, and injuries are Game-specific, so a shared pilot would be
> incoherent rather than convenient. Moving one is an explicit **fork** that
> copies and records its origin."_
>
> The conclusion did not follow from the premise. Game-specific state is only
> incoherent if one entity can be in two Games at once, and the container model
> makes that unrepresentable: `gameId` is a **single nullable column**, so an
> entity is in at most one Game by construction. Forking solved a problem the
> schema already prevents.
>
> Note that a fork is **not** the same thing as the copy sanctioned above, and
> the difference is the origin it "records". A copy is a clean break — a new
> build of yours with no tie to what it came from. A fork keeps a relationship,
> and a relationship between two records of one character is precisely the thing
> that has to be reconciled, watched, and eventually gets out of step. The verb
> that survives is the one with nothing to keep in sync.
>
> No fork was ever built, so this amendment does not change behaviour;
> `MoveToContainerControl` re-stamps `gameId` in place and
> `entities.upsertByAppId` re-homes the existing row. What it changes is the
> instruction: that in-place move **is** the design, and the absence of a fork
> mutation is not a gap for somebody to close later.

#### 3. Roles: a base role plus one modifier

Every member of a Game is a **Player** or a **Mediator**. **Organizer** is an
_orthogonal administrative flag_ carried by one of them — not a third role, and
never held by a non-participant.

- **Player** — owns their own pilots and mechs. The default.
- **Mediator** — owns the world: NPCs, alerts, the Downtime phase. **May also own
  a pilot and play.** The schema permits several; the UI is built for one.
- **Organizer** — invites, membership, settings, rename, delete, transfer. Exactly
  one per Game. **Confers no authority over game content**: an Organizer's reach
  over pilots, mechs, and the crawler is whatever their base role already gave
  them.

The one deliberate bend: **assigning ownership** belongs to the Mediator, but
falls back to the Organizer when a Game has no Mediator, so there is never a state
in which nobody can hand out a pilot. This is defensible because who-owns-what is
closer to membership than to content — assigning a pilot never edits one.

#### 4. Cross-player writes: propose, never impose

**A Mediator never writes another person's sheet.** They push a **proposal**; it
arrives on the player's Dashboard with the before/after visible, and the player
applies or declines it. Proposals persist until answered — no timers, no expiry,
and **no force-apply**, which would collapse this straight back into the direct
write this decision rejects. A newer proposal against the same field marks the
older one superseded, so a player never faces two contradictory pending changes
to one value.

This keeps ADR-001's honour-system ethos intact while giving the Mediator real
reach, and it means **alerts and cross-player writes are one mechanism, not two**.

Owners may always **release** what they hold, and the Mediator may **reassign**,
so a mis-assignment is fixable. A player may own any number of entities in a
Game — solo play and covering for an absent player both need it.

> **Amended: players self-claim what is offered.** This section originally read
> "ownership is assigned rather than claimed: players do not self-claim". That
> is reversed. An unclaimed entity is an **offer to the crew** — that is the
> whole reason the Mediator pre-builds characters and a template seeds six of
> them — so a player taking one is accepting an offer, not seizing anything.
> Requiring the Mediator to hand each one over individually added a round trip
> to the first ten minutes of every table and bought no safety.
>
> The boundary the original rule protected is intact and is the important half:
> **claiming touches only what is free.** An entity somebody already holds
> cannot be taken; it must be released first, by its owner or by the Mediator.
> `assign` remains the table runner's power to place an entity with a
> _particular_ person, which self-claim cannot express.

#### 5. Visibility

Inside a Game, every member sees every crewmate's **vitals live** and may drill
into a crewmate's full sheet **read-only**. The Mediator's prepared opposition
(`encounterNpcs`) is the one thing that stays hidden. The **crawler is communal**:
no owner, read by every member, edited only by the table runner
([ADR-038](#adr-038) §5), with writes merged per field.

#### 5a. Setting the table up: who raises the crawler, and when a Game takes crew

Communal is not free-to-**create**:

- **Raising and scrapping a crawler is the table runner's act** — the Mediator,
  or the Organizer while a Game has no Mediator (the same narrow fallback §3
  already grants for assignment, and for the same reason: a Game is created with
  `mediator: false` on its only membership, so a Mediator-strict rule would make
  every new Game an unreachable state). So is filling its fields (§5, as
  amended by [ADR-038](#adr-038) §5).
- ~~**A Game takes a player's pilots and mechs once it has a crawler.**~~
  **Amended by [ADR-037](#adr-037):** any member may bring
  their pilots and mechs into any Game they belong to, crawler or not. The
  anchoring this bullet wanted is now explicit instead of a gate: the first
  crawler to arrive becomes the Game's **primary** and takes aboard everyone
  already there, and whoever enters later is assigned to the primary on the way
  in. Moving a crawler into or out of a Game is the table runner's act.
- **A Game may hold several crawlers.** This was always true of the schema and is
  now true of the surfaces. A campaign that loses a crawler and rebuilds, or
  meets and eventually joins a second, is ordinary play rather than a state to
  reject.

The line all three sit on: a table runner arranges **what the crew sails in and
who holds what**, and still cannot change a number on somebody else's sheet. For
that there is a proposal (§4).

Enforced in `convex/model/permissions.ts` (`requireTableRunner`) and
`convex/entities.ts`, and mirrored — never re-decided — for the UI in
`apps/itun/src/lib/games/gameRoster.ts`.

#### 6. Surfaces

The **Mediator gets its own surface**, the layer ADR-021 deferred; the Encounter
tray is absorbed into it and `/encounter` retires. The player Dashboard's locked
1280×800 canvas ([ADR-038](#adr-038) §9) is
**not** reopened: crew vitals arrive as a Crew tab in the display
([ADR-038](#adr-038) §4).

**A Game's crew is rendered as the Roster renders a shelf.** `/games/:id` (any
member) and `/mediator/:id` (the Mediator, who gets the private instruments
below it) both open with the same three ontology-toned columns of `EntityRow`s
the home Roster uses, with a create CTA per column and a Dashboard launch on the
rows that support one. A Game asks "what have we got and what can I do with it"
of a different container, and answering it in a second visual vocabulary is how
an app stops feeling like one app.

What a shared roster adds on top of the personal one: an owner chip per row,
an **UNCLAIMED** stamp seal that opens the pick-up confirm, and creation gated by
§5a. Only entities the viewer **owns** offer a sheet link; ITUN's sheet is a live
editing surface, so opening a crewmate's would hand over an editor whose writes
the server refuses. The read-only drill-in §5 permits is a separate surface and
is not built — the crew vitals strip carries that information for now.

### Amendment — an invite carries what the Organizer decided

§3 gives the Organizer "invites, membership" and stops there, leaving a code as
a bare key and the seat and the hand-out as separate acts performed after the
fact. That is amended in one direction: **an invite now expresses a decision the
Organizer has already made.**

**An invite may be minted as a request.** With approval required, the code
identifies the Game and grants nothing until the Organizer lets the knocker in.
This adds no role and no membership state — a pending request is _not_ a
membership, and an approved one produces exactly the membership a direct redeem
would, through the same code path. Bearer codes remain the default; this is a
per-invite choice, not a mode.

The reason is §5. Membership confers read access to every crewmate's sheet, so
a code posted somewhere public is a broader disclosure than the Organizer
intended. Approval is the Organizer exercising the membership authority §3
already gives them, one step later.

**An invite may also carry a seat and a hand-out** — a `role` of Player or
Mediator, and a list of unclaimed entities handed over on join.

This sits alongside the self-claim amendment above rather than against it. That
amendment made an unclaimed entity an **offer to the crew**, which anyone may
accept; `assign` survived it as the table runner's power to place an entity with
a _particular_ person. An invite grant is exactly that power, scheduled: the
Organizer names the recipient in advance, and the Change Log records **them** as
`actorId` rather than whoever walked through the door. Both routes to ownership
respect the same boundary — neither can touch an entity somebody already holds.
A grant whose entity has since been claimed, moved, or deleted is **skipped, and
the join still succeeds**: arriving without the promised pilot is a notice,
whereas failing the join over a stale pointer would strand someone outside a
Game they were genuinely invited to.

Revocation becomes a **soft delete**, so an invite's redemption history stays
resolvable, and it never evicts anyone already seated: closing a door is not the
same act as removing someone from the room.

Enforced in `convex/invites.ts` (`seat`, `assertSpendable`, `decideRequest`).

**Extended by [ADR-039](#adr-039):** an invite may also carry
an address — a Discord account, which alone may redeem it. An addressed invite
is single use and its addressee may decline it.

### Amendment — the crawler can sit on a shelf, and deleting a Game destroys nothing

§5 says the crawler is **communal**, and the schema expressed that by giving it
no `ownerId` column at all and a non-nullable `gameId`: a crawler was a thing
that could only exist inside a Game. That second half is amended. `crawlers` now
carries the same two container columns as `pilots` and `mechs`.

**Communal is unchanged.** It is now written as `ownerId: null` on a row whose
`gameId` is set — the same fact, stated in a column instead of by a column's
absence. Conflicting writes still resolve by field-level merge, and raising,
scrapping and (since [ADR-038](#adr-038) §5) editing one inside a Game are the
table runner's acts.

What the amendment adds is the third row of §2's ownership table — `gameId:
null` with an owner, *on the shelf* — which the crawler was the one entity
unable to occupy. Two things were being worked around rather than fixed:

- **Deleting a Game had to destroy its crawler.** Pilots and mechs fell back to
  a shelf; the crew's home had nowhere to fall to.
- **Claiming a Solo roster invented a container.** `entities.claimLocal` parked
  a claimed crawler on a placeholder "Claimed crawler" Game of one, complete
  with a membership, because the shelf could not hold it. That Game appeared in
  the player's list as a table they never made.

`gameId == null && ownerId == null` remains the one invalid combination, for the
crawler exactly as for everything else — which is *why* a shelved crawler must
take an owner. A crawler stops being communal at the moment it leaves a Game,
because communal is a property of being in one.

#### Deleting a Game

**Organizer only**, and deliberately not the table runner: `requireTableRunner`
hands authority to the Organizer only while a Game has no Mediator, which would
make who may end a campaign depend on whether one had been appointed yet.

Nothing anybody built is destroyed:

| What                            | Where it lands                 |
| ------------------------------- | ------------------------------ |
| a pilot or mech with an owner    | that owner's shelf            |
| an **unclaimed** pilot or mech   | the deleting Organizer's shelf |
| every **crawler**                | the deleting Organizer's shelf |

The receiving shelf for the last two rows is the deleter's because they are the
one person guaranteed to exist and to be looking at the consequence as it
happens.

What does go is the **table**: memberships, invites, pending join requests, the
Mediator's opposition tray, and the soft links. A link is a fact about the
table's wiring rather than a possession — a pilot-to-crawler assignment means
"aboard this crew's crawler", which stops being true when the crew disbands — so
shelved entities land unwired.

#### Why not keep a shelved crawler in the browser only

The rejected alternative was to copy the crawler into IndexedDB on deletion and
leave the server out of it, which needs no schema change. It is rejected on
principle: offline-first in ITUN is ordinary PWA caching, so the local store is
a **reflection** of Convex and never a second source of truth. A record with no
server row to reflect is invisible on the player's other devices, invisible to
sync, and lost with the browser's storage.

### Amendment to ADR-022

ADR-022 states the Change Log is **local only** and never travels with a
published snapshot. The first half no longer holds: the log is now
**synchronized**, and gains `actorId`, a `state` of
`applied | proposed | rejected | superseded`, and a `supersededBy` pointer. A
proposal _is_ a log entry; applying one commits it.

The second half stands unchanged — **a published snapshot remains frozen,
historyless, and bare**. ADR-004 is not modified.

### Consequences

- **The app now holds PII.** Discord identifiers and profile data are real
  obligations the project did not previously have: account deletion, data export,
  and a plain-language privacy note are launch requirements, not follow-ups.
  Deleting an account transfers Organizer to the longest-standing remaining
  member and removes that account's owned entities; **the Game and the communal
  crawler survive**, so a campaign never dies because one person quit.
- **Anonymous use must keep working, forever.** Withdrawn by ADR-034: anonymous
  use still works, but nothing it builds persists without an account.
- **Convex cannot validate entity bodies.** The Zod schemas in
  `apps/itun/src/lib/schemas/` stay the source of truth and Convex stores bodies
  opaquely, so **every mutation must Zod-parse before persisting**. The
  alternative — mirroring every field into Convex validators — forks the source of
  truth into a second copy that rots.
- **ADR-021's modes are unchanged**, but each now carries an ownership question:
  a surface must ask _whose entity is this_ before asking what the mode enforces.
- **Cost scales with concurrent players, not accounts**, since an open Dashboard
  is a live subscription. No cap, seat limit, or paid tier is introduced; usage is
  instrumented and revisited at a real number.
- **Two deploy targets.** The SPA has its own host (a Cloudflare Worker since
  ADR-033); Convex is a data backend, not a host.
- Not adopted, deliberately: CRDTs or full offline sync; turn/initiative
  enforcement across players; net-new homebrew authoring; any change to snapshot
  sharing; accounts on `apps/srd`, which stays static, public, and login-free.

## ADR-031

**`srd` Builds on an In-House Vite SSG**

### Status

**Accepted. Supersedes [ADR-012](#adr-012)** (`srd` as an
Astro static site with React islands).

What ADR-012 _decided_ is unchanged and is re-affirmed here: `srd` is a
statically pre-rendered, no-backend, CDN-cacheable site with React islands for
the few interactive parts. **Only the machine that produces it changes.** Astro
is replaced by an in-house static-site generator at
[`apps/srd/ssg/`](../apps/srd/ssg/), whose implementation contract is
[`ssg/DESIGN.md`](../apps/srd/ssg/DESIGN.md). This ADR records _why_; that
file records _how_, and is the one to read before changing the build.

**Amended 2026-08-07 — decision 6 is retired.** The parity gate's Astro baseline
could no longer be regenerated, so `ssg/parity.ts` was deleted and replaced by a
self-hosted snapshot gate over the site's own last-blessed output. Read
everything below about parity in the past tense.

**Amended 2026-09-28 — the snapshot gate is deleted too.** In 51 days it caught
no regression and needed 17 re-blesses. srd's output is now held by targeted
checks; see "Verification" in [`ssg/DESIGN.md`](../apps/srd/ssg/DESIGN.md).

**Amended 2026-10-06 — the `typescript-classic` alias is gone.** Its one
consumer, the AST-walking architecture check, became three GritQL plugins in
[`tools/biome/`](../tools/biome/) and a Biome function-size rule, so nothing
needs the TypeScript 6 compiler API. The "Carried over unchanged" bullet about
the alias is history.

**Amended 2026-10-09 — decision 5's PWA replacement is `vite-plugin-pwa`.** srd's
service worker is generated by `VitePWA` in `ssg/vite.config.ts`, the plugin
ITUN uses, with its workbox options in `ssg/pwa.ts`. The precache globs only
js/css/woff2/svg, all emitted by `vite build`, so generating it there produces
the same 82 entries the post-SSG `workbox-build` call did. `registerSW.js` is
a static file in `public/`. Read "`workbox-build`'s `generateSW` over the
finished `dist`" below as this.

### Context

ADR-012 chose "**Astro, static, React islands**", and explicitly treated the
major version as incidental to the decision. Astro was, by the only measure that
matters for maintenance cost, cheap: in the site's entire history
`apps/srd/astro.config.mjs` was touched by **three commits** — the initial
catalog work, the Astro 7 upgrade (#365), and its upgrade-path doc (#362). None
of what follows is a complaint about Astro's behaviour.

#### The driver: a TypeScript 6 pin this repo could not fix

The repo moved to **TypeScript 7** (#447). `apps/srd` did not. It carried its own
`typescript: 6.0.3` devDependency for one reason: its typecheck script was
`astro check && tsc --noEmit`, and `astro check` is `@astrojs/check`, which
declares `peerDependencies: { "typescript": "^5.0.0 || ^6.0.0" }`.

**`@astrojs/check@0.9.10` — the latest release, published 2026-07-27 — still
declares that range.** That was read off the published manifest rather than
assumed, and it is what closed off the cheap option: there was no forward version
to upgrade into, and the fix lived in someone else's dependency graph on nobody's
published schedule.

The pin was not cosmetic. It meant one workspace's typecheck answered a
_different question_ from every other workspace's, using a different compiler,
against a compiler major the rest of the repo had deliberately left behind — and
every root-level tool that walks the source had to know that.

The alternative that _was_ locally available was rejected: drop `astro check`
from srd's typecheck and keep `tsc --noEmit`. That un-pins the compiler
immediately, but `tsc` cannot parse a `.astro` file, and **18 `.astro` files held
the site's routing, layout, head metadata and JSON-LD**. The choice was between
one workspace on a stale compiler and the site's routing layer type-checked by
nothing. Neither is acceptable as a permanent state.

#### What the Astro layer was actually buying

Five things. Four port trivially — file-based routing, the sitemap integration,
the PWA integration, and `Astro.props`/`params`/`url`. The fifth — zero-JS
components plus hydrated islands — was the whole question, and one finding made
it tractable:

**Islands can be mounted with `createRoot` rather than `hydrateRoot`.**
`useGameData`'s server snapshot is hardcoded `false` on purpose (the reason
`cardNeedsHydration` exists), so a genuinely _hydrating_ card renders its
fallback on the client's first pass while the server rendered the real thing —
the React #418 mismatch. Client-only mounting has no mismatch class at all: the
markup inside the placeholder is discarded and replaced. That removed the single
largest correctness risk in the migration, and it means **server-rendering an
island is an opt-in SEO/no-JS choice per island, never a hydration contract**.

The audit that preceded this also measured what the Astro shape was costing at
runtime: serialized island props totalled **18.7 MB across 1,039 pages**, of
which **`MobileNavIsland` alone was 17.3 MB** — the same 16.6 KB catalog blob
inlined into every page, roughly a third of a typical entity page. Astro's
props-per-island attribute encoding is what made that invisible.

### Decision

`srd` is built by an in-house static-site generator in `apps/srd/ssg/`: **Vite 8**
for the client bundle, **React 19** `renderToStaticMarkup` for the HTML, run
under Bun. `astro`, `@astrojs/react`, `@astrojs/sitemap`, `@astrojs/check` and
`@vite-pwa/astro` are removed, along with every `.astro` file and
`astro.config.mjs`.

1. **Routes are registered, not discovered.** A page is a
   `src/pages/**/*.page.tsx` module returning `{ meta, children }`; it is built
   only if `ssg/routes.ts` imports and registers it. Non-HTML outputs are
   `src/endpoints/*.ts` — **endpoints are not routes**. Output paths match
   Astro's exactly, including `/404` → `404.html` and dotted endpoints as files.
2. **The island protocol is a placeholder plus one props blob per page.**
   `<Island name client ssr>` emits `<div data-island … data-island-id>`; all of
   a page's props are emitted once as a single
   `<script type="application/json" data-island-props>`. `client` keeps Astro's
   four strategies 1:1 (`load` / `idle` / `visible` / `only`) so the existing
   directive guard test ported rather than being deleted. Mounting is always
   `createRoot`.
3. **`MobileNavIsland` takes zero props.** `buildCatalogSections()` is pure and
   `currentPath` is `location.pathname`, so the island computes both inside its
   own chunk — one shared copy instead of 1,039 inlined ones.
4. **`EntityCardStatic` stays out of the island system entirely**, rendering into
   the page tree and shipping no JS. It is 82% of entity pages; that path is
   untouched.
5. **Each Astro integration has a named replacement:** `@astrojs/sitemap` →
   `ssg/sitemap.ts` (same exclusion filter, same `sitemap-index.xml` +
   `sitemap-0.xml`); `@vite-pwa/astro` → `workbox-build`'s `generateSW` over the
   finished `dist`; `ClientRouter` → cross-document
   `@view-transition { navigation: auto }`; `prefetch` →
   `<script type="speculationrules">`; `astro check` → `tsc --noEmit`.
6. **`ssg/parity.ts` was the acceptance gate** (since retired — see _Status_).
   It compared the built `dist` semantically against an archived Astro
   baseline: file set, head metadata, JSON-LD, `<main>` text, all 899 JSON
   endpoints and `llms.txt`.
7. **srd's `typescript@6.0.3` pin is deleted**; the workspace typechecks on the
   repo's TypeScript 7 like every other one.

#### Measured

|                            | Astro                             | in-house SSG             |
| -------------------------- | --------------------------------- | ------------------------ |
| Build                      | 6.8s                              | **2.4s**                 |
| HTML payload across `dist` | 48.1 MB                           | **18.2 MB**              |
| `MobileNavIsland` props    | 17.3 MB over 1,039 pages          | **0**                    |
| Parity differences         | —                                 | **0 across 1,039 pages** |
| TypeScript                 | 6.0.3, pinned by `@astrojs/check` | repo-wide 7              |

The parity script is known to bite: it was run against **eight deliberately
injected defects** and failed on each. Zero differences is therefore a result,
not the absence of a test.

### Consequences

#### What was given up — stated plainly

**This repo now owns ~1,500 lines of build tooling, forever.** Precisely: 2,388
lines under `apps/srd/ssg/` at the time of the migration, of which ~1,491 are the
generator proper (`build.ts`, `dev.ts`, `render.tsx`, `document.tsx`,
`routes.ts`, `endpoints.ts`, `sitemap.ts`, `pwa.ts`, `outputPath.ts`, `types.ts`,
`vite.config.ts`) and 897 were the parity harness. That is traded against a
dependency that cost this repo three commits in its entire history.

**This is not a free win, and it should not be sold as one.** Astro's routing,
sitemap, PWA and SSR were maintained by other people, tested against far more
sites than this one, and improved without anyone here doing anything. None of
that is true of `ssg/`. There is no community, no issue tracker and no upgrade
path — `ssg/DESIGN.md` is the entire manual. What justifies it is narrow: the
cheap thing had a hard dependency on a compiler major the rest of the repo had
left, and no available version fixed it.

#### What will bite later

- **The dev server must keep rendering through the production path.**
  `ssg/dev.ts` runs Vite in middleware mode and renders every request through the
  same `render` / `renderDocument` pair `ssg/build.ts` calls, via
  `ssrLoadModule`. It is slower than a client-rendered dev shell would be, on
  purpose. If someone "optimizes" dev into a SPA fallback, what developers look
  at stops being what ships, and production-only bugs become writable again.
- **The css/SSR stub is load-bearing and order-sensitive.** The SSR pass runs
  under Bun, not through Vite, and `component-lib`'s barrel reaches modules that
  `import './x.css'`. `ssg/build.ts` registers a `Bun.plugin` stubbing `.css` to
  an empty module — and a Bun plugin only affects modules loaded **after** it
  registers, which is why everything downstream is imported dynamically.
  Promoting any of those `await import`s to a top-level import silently hands the
  behaviour back to the runtime. It appears to work unguarded today only because
  Bun currently loads `.css` as a text module; the first `@fontsource` import
  that drifts into an SSR module ends that.
- **`vite build` mutates `NODE_ENV` in the calling process, and the SSR pass
  cannot survive it.** Bun picks its JSX transform at startup (`NODE_ENV` unset →
  `jsxDEV`), but React's `jsx-dev-runtime` re-resolves at import time and its
  _production_ build is an empty stub, so every `component-lib` module dies with
  "jsxDEV_… is not a function". `ssg/build.ts` saves and restores the previous
  value around the Vite call. Anything else that invokes Vite programmatically in
  the same process needs the same guard.
- **srd reads Vite's default `VITE_` env prefix — do not re-add
  `envPrefix: 'PUBLIC_'`.** The build env is set only by
  `deploy-cloudflare.yml`. Re-adding it makes `VITE_SENTRY_DSN` inline as
  `undefined`, and srd's Sentry goes dark with every check green. The workflow
  still sets the `PUBLIC_` names alongside, solely so a rollback dispatch to a
  pre-rename commit builds with Sentry on.
- **A verification baseline that lives outside the system it checks will
  eventually stop being regenerable** — the parity gate's Astro baseline did.
  If a future gate needs an oracle, plan its expiry at the same time as its
  adoption.
- **The route registry must be maintained by hand.** A new page that nobody adds
  to `ssg/routes.ts` is simply not built, and nothing fails. That is the stated
  trade for having one file that tells you what the site emits.

#### Carried over unchanged

- **The root `typescript-classic` alias (`npm:typescript@6.0.3`) stays.** It is
  not Astro residue: `tools/check-architecture.ts` (since deleted) imports it for the
  TypeScript 6 compiler API, because TS 7's replacement `typescript/unstable/*`
  API has no single-file `createSourceFile`/`forEachChild` to walk. The alias
  goes when that API stabilises, not in an "Astro leftovers" sweep.
- No auth, no backend, no user data; a static deploy with no functions (a
  Cloudflare Worker serving static assets since ADR-033).
  [ADR-030](#adr-030) explicitly leaves `srd`
  public and login-free.
- Read-only choices ([ADR-010](#adr-010))
  and the CSP-safe jitless Zod constraint
  ([ADR-013](#adr-013)) are untouched. The per-page island
  props blob is `type="application/json"`, not executable script.
- New interactive features are still scoped as islands rather than turning the
  site into an SPA — ADR-012's closing constraint survives its framework.

## ADR-032

**Public, Read-Only Sheets**

### Status

**Accepted.** Amends [ADR-030](#adr-030) §5
(visibility) with one explicit exception, and narrowed what
[ADR-004](#adr-004)'s snapshots were _for_ without
changing anything ADR-004 decided.

**Amended by [ADR-036](#adr-036) (2026-10-06):** snapshots
are retired, so the public sheet is now the **only** account-free way to share.
The consequence below that kept both surfaces ("ADR-004 is narrowed, not
superseded") is withdrawn. An old `/s/:id` link shows a retired page (ADR-036,
as amended 2026-10-09).

**Decisions 4–5 amended (2026-10-06):** `publicSheet.get` also returns the
entity's direct assignments — a linked entity that is published itself with its
name and body, any other by its kind alone ("Not shared" on the page; publishing
is each owner's own opt-in, decision 2) — and the page renders the live
`<Sheet readOnly>` over `readOnlySheetStore.ts`, the store every read-only sheet
uses. Every other decision stands.

### Context

Two rules meet here and neither anticipated this case.

**ADR-030 §5 says visibility begins at membership.** Inside a Game every member
sees every crewmate's vitals live and may drill into a full sheet read-only, and
that is where seeing stops. The one deliberately unauthenticated read in the
whole Convex surface is `invites.preview`, which exists so that a link can
explain itself before sign-in and which is careful to disclose nothing beyond
what the invite already tells its bearer.

**ADR-004 says snapshots are the account-free way to hand someone a build.**
They are immutable, minted on demand, and stored as opaque blobs. That is the
right shape for a frozen record and the wrong shape for a link that lives
somewhere durable — a Discord channel, a forum signature, a bio. Such a link
wants to be _current_, and it wants to exist without anybody having remembered
to press a button.

The immediate driver is the Discord bot. `/su sheet` renders a crewmate's sheet
and links to the read-only Game view, which is correct and which requires an
account and a membership. A Discord channel routinely contains neither. Minting
a snapshot per invocation was considered and rejected on four independent
grounds, all recorded here because they are the reasons this ADR exists at all:

1. **Consent.** `/su sheet` reads _other people's_ sheets. Publishing on
   invocation would put somebody's character on a public URL because a third
   party ran a command.
2. **The id is the revoke capability.** `DELETE /api/snapshots/:id` has no auth
   by design, so posting a snapshot link into a public channel hands delete
   rights to everyone who can read it.
3. **Nothing expires and nothing indexes.** Snapshots have no TTL, and the only
   record of what has been published is `localStorage` in the publishing
   browser. A bot-minted snapshot is an orphan from birth.
4. **One IP for every server.** Publish is rate-limited per client IP and the
   bot is a single worker.

### Decision

Add a **public, read-only rendering of the live sheet**: a stable URL that needs
no account to open, is always current, and requires no publishing step.

1. **Opt-in, per entity, stored server-side.** A nullable `publicRead` column on
   `pilots`, `mechs` and `crawlers`, beside `gameId` and `ownerId` — which is
   where container and ownership already live. Absent or `false` means the
   entity is not readable without membership, which is the existing rule and
   therefore the default for every row that exists today.

2. **The owner decides; the table runner decides for the crawler.** Turning it
   **on** is owner-only for a pilot or mech, with no Mediator override — the
   same rule `assertMayWrite` applies to edits, though this is its own gate
   (`assertMayPublish`) rather than a reuse, for the reason in the next clause.
   The crawler has no `ownerId` at all, so it follows §5a and is the table
   runner's act (Mediator, or Organizer where a Game has no Mediator).

   Turning it **off is always permitted**, including on an entity whose
   `ownerId` has become null. This is where publishing deliberately diverges
   from `assertMayWrite`, and it is not a detail: `ownership.release` and the
   leave-Game sweep both null an `ownerId` on a row that is still in the Game,
   so refusing there would leave a published sheet permanently world-readable
   with its "Stop sharing" button refusing forever. Withdrawal can only ever
   reduce what is exposed, so it needs no owner to authorise it.

   One further path exists and is deliberate: a published **mech** resolves the
   abilities of the pilot flying it (see Consequences), and that pilot may be an
   **unclaimed** one in the same Game. Such a pilot has no owner to ask and is
   already visible to the whole table, so its ability slugs travel with the
   mech's numbers. A *claimed* crewmate's pilot never does — republishing their
   data past the membership boundary is theirs to decide, not their crewmate's.

3. **Addressed by `appId`, at `/p/:kind/:appId`.** Not the Convex row id,
   for two reasons: the owner already holds the app id, so the Share screen can
   build the URL with no round trip; and the bot already receives `appId` on the
   `sheet` payload, so it can render the link without a second call.

4. **One unauthenticated Convex query, returning one entity.** It returns
   `null` — not a refusal — for an entity that is not public, so a flipped-off
   sheet is indistinguishable from one that never existed.

5. **Rendered by the machinery that already exists.** `frozenSheet.ts` (since
   deleted) parsed a bare entity against the Zod schemas and wrapped it in a
   store whose every write throws; the snapshot page and the Game view were
   already its two consumers. The public sheet was a third and added no
   rendering code. (The snapshot page is gone since ADR-036; the store is now
   `readOnlySheetStore.ts` — see Status.)

6. **Turning it off revokes it everywhere, immediately.** There is one URL per
   entity and it is derived, not minted, so there is no set of outstanding
   links to chase. This holds unconditionally — see the second half of decision
   2 — because a promise of revocation that an ordinary sequence of play can
   take away is not a promise.

### Consequences

- **This is a real widening of who can read a sheet, and it is opt-in for
  exactly that reason.** The default is unchanged; a player has to choose. The
  free-text fields on a pilot — callsign, pronouns, motto, keepsake, appearance,
  background — become world-readable when they do, and the toggle says so rather
  than describing itself as "sharing".
- **The URL is not a secret and is not treated as one.** `publicRead` is the
  control, not the unguessability of an id. That is the opposite of the snapshot
  model, where the id _is_ the capability, and it is the better property: it can
  be withdrawn.
- **~~ADR-004 is narrowed, not superseded.~~ Withdrawn by
  [ADR-036](#adr-036).** This said snapshots would stop
  being the way to share a character and become the way to keep a _frozen_ one —
  "this pilot, as they were the night we lost the crawler" — with both surfaces
  kept. The product owner decided frozen sheets should not exist; ADR-004 is
  superseded and this page is the one way to share.
- **Serving live fixes a defect the frozen path cannot.** A published mech
  snapshot must carry `context.pilotAbilities` alongside the entity, because a
  bare frozen mech cannot see the pilot flying it and computes Max SP and Cargo
  without their contributions ([ADR-029](#adr-029)).
  A live query runs with the whole `softLinks` graph in reach and can resolve
  the piloting pilot properly.
- **Solo still works and is untouched.** `publicRead` is a Convex column, so a
  Solo user simply has no public sheets — the toggle is absent rather than
  broken, exactly as every other account-shaped feature behaves.
- **A public sheet is crawlable in principle.** ITUN ships no `robots.txt`, no
  sitemap and no server-rendered meta, and `/p/:kind/:appId` is a client-rendered
  route with no link graph pointing at it — so it is discoverable by nobody in
  practice, and deliberately not blocked either. If that changes, a `noindex` on
  this one route is the lever, and it is a decision to take on purpose rather
  than to inherit.
- **The link does not unfurl.** `index.html` carries no Open Graph tags and the
  route is client-rendered, so a bare link pasted into Discord or Slack shows
  nothing. That is why the bot renders the URL inside its own card. Giving this
  route server-rendered meta tags is a separate, later piece of work.

### Alternatives considered

**Always public, addressed by row id.** The least machinery, and the reading
that "it shouldn't need to be generated" most literally supports. Rejected: row
ids are not secrets here — they travel in crew payloads and in Game-view URLs —
so this makes every character in the database world-readable to anyone who has
ever seen one, with no way to turn it off.

**A per-entity random token.** Revocation could then rotate rather than only
switch off, and the row id would never leave the system. Rejected for now as
strictly more machinery for a marginal gain: `publicRead` already revokes, and a
rotating URL is a worse promise to make about a link somebody has put in their
bio. Worth revisiting if a token proves necessary for some other reason.

**Extending ADR-004 snapshots to auto-refresh.** Rejected because it contradicts
the property that makes a snapshot worth having. An immutable, historyless copy
is what ADR-030 explicitly re-affirmed; making it mutable would leave the
project with two live surfaces and no frozen one.

## ADR-033

**Hosting Moves to Cloudflare**

### Status

**Accepted and delivered.** Every production hostname is served by a
Cloudflare Worker: `intheunionnow.com` since 2026-08-19, `salvageunion.io` and
`assets.salvageunion.io` since 2026-08-31; Netlify and Render serve none of them.
Code comments that cite a cutover phase (`ADR-033 P4`) mean the deleted plan:
`git show c2476d1c:docs/architecture/cloudflare-cutover.md`. The decision as
first written, with the cutover's context and hazards:
`git show bc9f08ce:docs/ARCHITECTURE.md`. Current identifiers (Workers,
buckets, zones) are in [services and agent tooling](#services-and-agent-tooling).

**Amended 2026-10-06 — §Credentials: the deploy secrets move into a `production`
GitHub Environment** restricted to `main`, so a workflow copy
dispatched from a branch cannot read them.

**Amended 2026-10-08 — §Credentials: the deploy runs on `push` to `main`**,
gated by the strict `main` ruleset.

**Amended 2026-10-09 — `srd` gains a Worker script that answers misses.**
`_headers` matches by path, not status, and Static Assets applied its
`/assets/*` rule to the `404-page` response, so a missing chunk's 404 was
`immutable` for a year. The zone Transform Rule meant to override that was not
in effect on `salvageunion.io` (production answered `immutable`, and the deploy
smoke failed on it). `src/worker/index.ts` now runs for every miss, as itun's
does, and answers it with `no-store`; real files never run it. No rule outside
the repo is relied on for this any more.

**§3 is history since [ADR-036](#adr-036)** retired snapshots: nothing reads
or binds the snapshot bucket.

Amends [ADR-004](#adr-004), since superseded: snapshots moved from Netlify
Functions + Blobs to a Worker + R2 with ADR-004's contract unchanged.

Re-affirms [ADR-031](#adr-031) and
[ADR-030](#adr-030) without changing either.
`srd` remains a statically pre-rendered no-backend site; Convex remains the
server of record for identity, ownership and sharing. **Only the host changed.**

### Context

Hosting was split three ways: Netlify served `srd`, `itun` and `su-assets`,
Render ran the Discord bot as a gateway worker, and Convex ran the accounts
backend. Cost was not the reason to move (Render's $7/mo worker was the only
line item). Consolidating onto one platform was, together with ending a class
of Discord gateway failure. The bot's data layer fit Workers Free, measured
rather than assumed: 549.6 KiB compressed and a 141 ms startup.

### Decision

**1. Hosting is Cloudflare.** `srd` and `itun` are Workers Static Assets,
`su-assets` is a Worker over R2, and the Discord bot is a Worker answering HTTP
interactions.

**2. The cutover was hard, with no rollback.** Per-phase verification was the
only safety mechanism, so every phase carried a gate written so that it could
fail.

**3. Snapshots used R2, not KV.** KV's up-to-60-second propagation and cached
negative lookups would have turned publish-then-read into a hard not-found.

**4. Builds run in GitHub Actions; deploys use `wrangler`.** Workers Builds is
not adopted: `srd`'s build provisions Chromium to render per-entity OG images,
and one build path keeps one place for path filtering and the CI gates in front
of every deploy.

**5. Convex stays, and nothing here may foreclose moving it.** Replacing Convex
with D1 is a separate decision needing its own ADR (see the follow-up below).
So the Worker↔Convex boundary stays plain HTTP with a bearer token.

**6. Everything runs on the existing `alxjrvs@gmail.com` account.** A dedicated
account was declined. Cloudflare isolates by account, not project, so this
project shares the Workers Free quota (100k requests/day, 10 ms CPU) and the
`alxjrvs.workers.dev` subdomain with RANDSUM's two Workers, `randsum-rdn` and
`randsum-site`; preview URLs are `<worker>.alxjrvs.workers.dev`, and renaming
the subdomain would move RANDSUM's Workers.

**7. A failed gate halts the deploy.** No gate is worked around, relaxed, or
retried with different parameters to obtain a pass. With no rollback, treating
a red gate as an obstacle converts a caught problem into an unrecoverable one.
This rule exists to be cited.

### Consequences

- **The Discord bot displays as permanently offline** in every server:
  presence needs a gateway session, which an HTTP-interactions app never has.
  It works when invoked. Liveness is the bot's `/health`, which
  `tools/smoke-production.sh` checks after every deploy and nightly, so a
  revoked token surfaces up to a day later.
- **The bot's endpoint is application-level**, so a change reaches every server
  at once, with no canary. Its pre-deploy gate is a signed replay harness, not
  a staged rollout.
- **Module scope on Workers forbids timers, async I/O and randomness.**
  `new REST()` throws at startup, and so would any module-scope observability
  initialisation.
- **Zod's `jitless` configuration is load-bearing for the runtime**, not only
  for CSP: workerd bans `new Function`. Do not revert
  `packages/salvageunion-reference/lib/zod.ts` as an optimisation.

### Credentials

Only GitHub Actions holds deploy credentials (decision 4), so CI holds a token
that can deploy production. The bar it is held to:

- A Cloudflare API token scoped to *Workers Scripts: Edit* and, for R2,
  **narrowed to the named buckets** rather than account-wide. Cloudflare scopes
  R2 per bucket but not Workers per script, so the Workers half can edit any
  Worker on the account (§6). Narrow the half that can be narrowed, and do not
  describe the other half as contained.
- Stored as a secret of the `production` GitHub Environment, restricted to
  `main`, with no reviewers. Never at repository
  level, in a `wrangler.jsonc`, or in a `.env` git can see.
- Every deploy follows a merge, and the `main` ruleset merges only a branch
  that is up to date with `main` and passed `CI Success`, so a red gate cannot
  deploy. A green gate suffices: production deploys need no environment
  approval.

### Accepted risks

- **No rollback**, chosen deliberately.
- **The CI token reaches the whole personal account**, RANDSUM's two Workers
  included. With an agent PAT carrying `workflow` scope and no required human
  review, "merge a PR" reaches production with no human in it, and not only
  this project's. Revisit if RANDSUM's deployments become something this
  repository must not be able to touch; adding anything else to the account
  widens it.
- **The bot displays permanently offline** in every server.

### Configuration outside the repo

Three things are configured in the Cloudflare dashboard and are invisible to
`grep`: Images Transformations (enabled per zone), **Always Use HTTPS** (SSL/TLS
→ Edge Certificates, on both zones), and one **Redirect Rule** per zone sending
`www` to the apex.

A missing chunk's 404 is NOT among them: each app's Worker answers every miss
with `no-store`, where `_headers`' `/assets/*` `immutable` rule does not reach,
and `tools/smoke-production.sh` asserts it on both sites. A Response Header
Transform Rule doing the same, if one exists on either zone, is redundant.

Always Use HTTPS answers every plain-http request on either zone, `www` and
`assets.` included, with a 301 to its https twin. Without it plaintext reaches
the Workers and is served as-is: HSTS protects only a browser that has already
seen an https response, and the Redirect Rule matches `www` over https only.
`tools/smoke-production.sh` asserts the 301 on all five hostnames.

| Zone                | When host equals        | Then                                          |
| ------------------- | ----------------------- | --------------------------------------------- |
| `salvageunion.io`   | `www.salvageunion.io`   | 301 → `https://salvageunion.io` + path, query |
| `intheunionnow.com` | `www.intheunionnow.com` | 301 → `https://intheunionnow.com` + path, query |

`_redirects` cannot do this: Cloudflare lists domain-level redirects as
unsupported and ignores malformed rules silently. Built from the dashboard's
"Redirect from WWW to root" template, two settings matter: tick **Preserve query
string** (off by default; srd has `/search?q=…`), and when it offers to create a
proxied `www` record, **decline** — wrangler's custom-domain attach creates that
record and fails with 409 Conflict if one already exists. `www` stays attached
as a Worker custom domain so that a missing rule serves the site, with correct
canonicals, rather than an error.

### Follow-up: Convex → D1

Out of scope, with its own future ADR; recorded because decision 5 binds today.
Schema translation to SQLite is the easy part. Three things are not:

1. **Reactivity.** D1 has no subscriptions, and ADR-030 makes the reactive model
   the product feature. Cloudflare's answer is Durable Objects with hibernating
   WebSockets (a real design exercise) or polling (a product downgrade).
2. **Auth.** Discord OAuth terminates on Convex via `@convex-dev/auth`.
   Replacing it means owning the OAuth flow, session issuance and refresh, and
   the `authAccounts` lookup the Discord bot uses to resolve a snowflake.
3. **Transactions.** Convex mutations are serializable by default; invariants
   the platform guarantees today would have to become explicit.

## ADR-034

**Persistence Requires an Account, and the Local Store Is Only a Cache**

### Status

**Superseded in part 2026-10-08 (#1152): there is no pre-account migration.**
The consequence below that *"existing local data is never destroyed"* and that
signing in claims it into the account is withdrawn, along with the claim path
that carried it (`claimLocal`, `AccountReconciler`'s device pass, the `legacy`
cache origin). An IndexedDB upgrade empties the cache and the server refills
it; a roster that only ever lived in one browser is not carried forward. The
three decisions stand.

**Amended 2026-10-09 (#1183): there is no build without a deployment.**
`apps/itun/vite.config.ts` refuses to start without `VITE_CONVEX_URL`, so the
consequence below about a build with no `VITE_CONVEX_URL` is withdrawn: such a
build is refused, not shipped.

**Accepted and delivered; decision 1 amended 2026-10-08.** Signed out, ITUN is
**read-only, in every build**: building needs an account, and an anonymous write
is refused (`requireWritableBackend`, reason `signedOut`) rather than kept in
memory for the tab. There is no `VITE_REQUIRE_ACCOUNT` flag and no durable
anonymous `local` backend, and the e2e suite signs in through `TestAuthBridge`. Where this ADR describes Solo as
IndexedDB-backed, read it as history. The phased delivery plan was deleted once
every phase closed (`git show c2476d1c:docs/architecture/persistence-and-pwa.md`);
what stays true of it is in
[data flow](#data-flow).

**Partially superseded by [ADR-035](#adr-035)**,
which withdraws one consequence recorded below — *"Declining the claim is a
terminal choice, by design"* — and the *offered, not automatic* rule it rests on.
The three decisions here are untouched and this ADR remains the governing one for
all of them; ADR-035 closes the migration window that was still keeping decision
2 from being true. Read it before reasoning about anything below that involves
`ClaimLocalData` (deleted), declining, or a browser holding a pre-account roster.

**Partially supersedes [ADR-030](#adr-030)** —
its §1 guarantee that Solo mode ("not signed in, IndexedDB is the source of
truth") "must keep working forever", and nothing else. **ADR-030 remains the
governing ADR** for Games, memberships, the role model, ownership, the two
containers, and Convex as the server of record; it is not superseded, and it
stays the right thing to cite for all of that.

**Amends [ADR-002](#adr-002)** (IndexedDB + Zod). The
storage technology and the Zod-parses-at-the-edge discipline are unchanged; what
changes is IndexedDB's *status* — it stops being anywhere's source of truth and
becomes a cache of Convex.

**Amends [ADR-022](#adr-022)** for the second
time. ADR-030 already claimed the Change Log is "now synchronized"; this ADR
makes that a requirement on the client too, not only a statement.

**Amended by [ADR-038](#adr-038)** (built): in "What is not data", mount state
is no longer a device preference.

Re-affirms [ADR-032](#adr-032) without changing it: a
public sheet stays an unauthenticated **read** of a row that an account owns.
Reading has never required an account and still does not.

### Context

ADR-030 replaced ADR-001's no-backend stance with Convex as a server of record,
but it kept a promise: an anonymous user would always have a fully working app
whose data lived in IndexedDB, and that mode would be supported forever. The
promise was load-bearing at the time. ITUN had years of local-first users, no
accounts existed yet, and a migration that could strand somebody's roster was
the worst outcome available.

That promise has since produced a **second source of truth**, and the cost is no
longer hypothetical. Three separate observations converge on the same defect.

**The app holds records the server has never heard of.** Signed in, a saved mech
pattern is written to IndexedDB and mirrored nowhere: `patternStore` writes
straight through to `db.mechPatterns`, and the only thing that ever inserts into
the Convex `mechPatterns` table is the one-time `entities.claimLocal`. The same
is true of the client's encounter NPCs, whose Convex table of the same name is
written only by `mediator.ts` and is a different set of rows entirely. And local
Change Log entries never leave the device, while the Convex `changeLog` carries
only server-originated entries from `ownership.ts`, `proposals.ts` and
`botClient.ts`. Three stores, one shape of bug: a signed-in player's work is
partly on a device and partly on a server, with nothing reconciling them.

**Deleting a Game exposed the same gap in the schema.** Until #871 a crawler
could not exist outside a Game — `crawlers.gameId` was non-nullable and there
was no `ownerId` — so deleting a campaign had to destroy the crew's home. The
cheap fix was to copy the crawler into IndexedDB and leave the server out of it.
That fix was rejected and the schema moved instead, because a record with no
server row to reflect is invisible on the player's other devices, invisible to
sync, and lost when browser storage clears. #871 is the worked example of the
rule this ADR now states in general.

**"Local-first" was doing work as an identity, not as an engineering choice.**
The offline story here is what any competent Progressive Web App does: cache
what you have so the app opens without a network. It never needed a bespoke
architecture, and having one meant every feature had to be designed twice — once
for an account and once without — with the second design silently accumulating
the records above.

### Decision

Three decisions. They are stated separately because they are separately
falsifiable, but they are one change: each is unenforceable without the others.

#### 1. Building requires an account

Signed out, ITUN is **read-only**: creating, editing, importing and copying
need an account, the Roster and `/…/new` routes show a sign-in panel instead,
and the store refuses an anonymous write. Until the amendment a visitor could
build in memory and was asked to sign in only to save; any reload, a deploy's
included, lost that work.

Reading is unaffected. A public sheet (ADR-032) and the whole of `srd` remain
open to anyone with no account at all.

**Discord remains the only door.** ADR-030 §1 chose it deliberately — the
audience already lives there, the project ships a Discord bot, and one identity
is what makes that bot usable — and gating persistence does not change any of
that reasoning. The consequence must be stated rather than discovered: **a person
with no Discord account cannot save anything, ever.** That is accepted, and it is
accepted *because* of the escape hatch below. Without the hatch this decision
would be indefensible.

**Export to file is the escape hatch, and it is now load-bearing.** A player
can download their work as a JSON bundle and import it into an account. This is not a new mechanism — `ExportAllButton`, `buildExportBundle`
and `mergeImport` already exist and already do it — but its *status* changes.
Export stops being a backup convenience and becomes **the guarantee that hitting
the account gate is never a data-loss event**. A file is not a source of truth
and never syncs, so it is fully compatible with decision 2; what it is, is a way
out.

Treat any incompleteness in the export bundle as a defect against this ADR, not
as a missing nice-to-have. See *The Change Log is not in the bundle* below.

#### 2. Every record is DB-backed; the local store is a cache

**Convex is the source of truth for every persisted record, without exception.**
IndexedDB holds a reflection of it, and holds nothing else. There is no record,
of any kind, that exists only on a device.

The practical test, and the one to apply when reviewing any future change: *if
this row is not in Convex, is it lost when the user opens the app on their
phone?* If the answer is yes and that is acceptable, it is not data — it is a
device preference (see *What is not data* below). If the answer is yes and it is
not acceptable, the schema is wrong and the schema moves.

This closes the three gaps named in Context — but **not by adding mirrors.**

**The mirror is a bridge, and this ADR is what removes the gap it bridges.**
`entityBackend.ts` states its own three properties plainly, and every one of them
is a consequence of the local store being able to run ahead of the server: it
*upserts* rather than updates, because "an entity built while Solo has no server
row until the account is claimed"; it is **fire-and-forget**, because "the local
write already succeeded and is what the UI reads", so a failure becomes a console
warning; and it runs only in `remote`, because "in Solo there is no server to
mirror to".

None of those premises survive decision 1. There is no pre-account entity for an
upsert to converge, and a cache can never legitimately be ahead of its source —
so a write that the server refuses must **fail the user's action**, not be
swallowed. Fire-and-forget is how this repo already lost an evening of play.

So the end state is not "six mirrored stores". It is **no mirrors**: the client
writes to Convex and reads Convex's reactive result, and IndexedDB is populated
from that. `appId` is part of the same bridge — it exists because the client
mints ids, which it does because it used to be the source of truth — and it goes
when the bridge does.

**`encounterNpcs` is one table with two containers, not two concepts.** An NPC
lives either in a Game — the Mediator's prepared opposition, `gameId` set — or on
somebody's shelf, their own tray to prep in before a Game exists. That is the
ownership table from ADR-030 §2 applied unchanged, and it is the *same move*
#871 made for the crawler: `encounterNpcs.gameId` is `v.id('games')` with no
`ownerId` today, which is precisely the shape `crawlers` had before it. Give it a
nullable `gameId`, an `ownerId`, a `by_owner` index and an `appId` to address
mirrored writes, and the collision resolves into the model everything else
already uses.

Rejected: renaming the local one to a "scratch tray". It would stop the collision
without removing the second concept, leaving a contributor two NPC ideas to keep
straight forever in exchange for a smaller diff now.

`mechPatterns` needs less: it already carries `ownerId` and a nullable `gameId`.
What it lacks is an `appId` — which is why `claimLocal` has to match patterns by
reading an id out of the opaque body — and a mirror.

#### 3. Both apps are ordinary, installable PWAs — and install is what buys offline

`itun` and `srd` are both **full PWAs**: installable, with a web app manifest,
icons, and a service worker. Both already are; this decision is mostly about
closing gaps and about what offline *means*.

**Offline is table stakes, not a feature.** There is to be no local capability
in either app that you would not find in any competent PWA. This is the same
rule as decision 2 seen from the other side: the reason the local store may only
be a cache is that caching is all a PWA's local storage is for.

**Install is the trigger for full offline availability, and visiting is not.**

- A user in a browser tab gets the ordinary thing: the app shell, and whatever
  they have actually visited, cached at runtime. **An online visitor does not
  pre-download the site.** `srd` deliberately does not precache its 1,039 HTML
  pages today, and that stays true for browser visitors — a multi-megabyte
  install is not a courtesy to somebody who came to read one page.
- An **installed** app is expected to work offline in full. Installation is a
  user saying "I want this on my device", and it is the honest point at which to
  spend their bandwidth and storage.

**"No distinct difference" does not mean one shared implementation.** The two
apps keep the update strategy each one's failure history justifies. `itun` stays
on `registerType: 'prompt'` — `autoUpdate` there activated a new worker under a
live page, ran `cleanupOutdatedCaches()`, and deleted the precache that page was
still resolving chunks against, which is why share links needed four or five
refreshes. Forcing a single strategy across both apps in the name of uniformity
would re-open that outage or change `srd` for no reason. Uniformity is in the
*posture* — installable, cache-only, no bespoke local behaviour — not in the
config.

#### What is not data

Device preferences are exempt from decision 2, and the exemption is narrow. A
preference qualifies only when losing it costs the user nothing but a moment's
re-adjustment: which container is active, dashboard display preferences, the
"you have unexported changes" nudge, the one-time claim marker, ~~ephemeral mount
state~~. These may stay in `localStorage`. **Amended by
[ADR-038](#adr-038):** mount state becomes Game data, saved on the pilot's seat.

**A preference that is expensive to lose is data.** If the list ever grows to
include something a user would be annoyed to re-create, that is the signal it
belongs in Convex, not a reason to widen the exemption.

### Consequences

- **Anonymous users lose durable local storage, and this is the real cost.**
  Somebody who does not want an account can no longer keep a roster on their own
  machine. That is a genuine loss of a genuine capability and should be stated
  plainly rather than presented as a cleanup. It is accepted because the
  alternative — two sources of truth forever — has already produced silent data
  divergence in three stores. Since decision 1's amendment, trying the
  builders at all needs an account too.

- **Existing local data is never destroyed.** Every current Solo user's
  IndexedDB stays readable, and signing in **prompts them to claim it** into the
  account. `ClaimLocalData` and `entities.claimLocal` already implement exactly
  this, already offered rather than automatic, and already idempotent. No new
  migration mechanism is invented; the phase is about coverage and about what
  happens to somebody who declines.

- **A build with no `VITE_CONVEX_URL` is no longer a working app**, and this is
  the largest hidden consequence: CI and a fresh checkout get only the in-memory
  anonymous mode from decision 1, so anything asserting durability runs signed
  in against a test deployment.

- **Convex becomes a hard dependency of the ITUN product**, not a feature of it.
  A Convex outage stops new saves rather than degrading to local writes. That is
  the same trade ADR-030 already made for Games (Disconnected is read-only, not
  a write queue), now extended to everything; an outbox is still refused, for
  ADR-030's original reason — it reintroduces the conflict resolution that
  choosing a server of record exists to avoid.

- **Every feature is designed once.** The "what does this do in Solo?" question
  disappears from every future change, which is the compounding benefit and the
  main reason this is worth the cost above.

- **Export becomes a tested guarantee rather than a convenience**, because two
  separate decisions now rest on it: the anonymous escape hatch, and what happens
  when somebody declines the claim. A silently incomplete bundle is a data-loss
  bug from the day this ships. It needs a gate asserting it covers every kind,
  and that gate has to be extended whenever a kind is added.

- **The Change Log is deliberately not in the export bundle.**
  `buildExportBundle` covers pilots, mechs, crawlers, soft links, patterns and
  encounter NPCs, and stops there. That was an accident while export was a
  backup; it is a **decision** now that export is the way out, so it is recorded
  rather than left to be rediscovered.

  The reasoning is what export is *for*. Somebody downloading a bundle because
  they will not make an account wants their pilots, not an audit trail of how
  each stat reached its current value. The log is provenance **about** the
  builds rather than the builds themselves, and ADR-022 already treats it as a
  separate kind of thing — a published snapshot is "frozen, historyless and
  bare" and nobody has ever asked for that to change.

  There is also a mechanical reason not to reverse this casually: `mergeImport`
  mints a **fresh UUID per row** on import, so log entries carried across would
  address entities that no longer exist under those ids. Including the log would
  mean either a remap pass or entries pointing at nothing — real work, in service
  of something no user has asked for.

  **What this costs, stated plainly:** a user who leaves via export loses their
  Change Log. That is accepted. If it is ever reversed, export-only (carry it in
  the bundle, never re-import it) is the shape that avoids the id problem.

- **Declining the claim is a terminal choice, by design.** A user who declines is
  pushed to export and then not asked again. This is the least-nagging option and
  it has a real edge: somebody who declines, does not export, and later clears
  their browser storage has genuinely lost that roster. The mitigation is that
  the export must be *taken* rather than merely offered.

- **Storage and bandwidth on install become a real budget.** Deciding that an
  installed app works fully offline means someone must own what "fully" costs —
  for `srd` that is on the order of a thousand pages or the JSON endpoints
  behind them. An unmeasured "download everything on install" would be a worse
  experience than the 404 it replaces.

- **`srd` gains no accounts.** It has no user data and this ADR gives it none.
  Decision 1 does not apply to it; decisions 2 and 3 do, and for `srd` decision
  2 is trivially satisfied because it stores nothing.

### Alternatives considered

**Keep Solo forever and mirror it too.** Rejected: mirroring a source of truth
is not mirroring, it is synchronization, and it lands squarely back in the
conflict-resolution problem ADR-030 chose a server of record to avoid.

**Keep Solo but freeze it — read-only for anonymous users, no new writes.**
Rejected as the worst of both: it retains all the two-sources-of-truth machinery
and the second design of every feature, while still taking the capability away.
Claim-on-sign-in achieves the same migration without keeping the architecture.

**Local-only with an explicit opt-in "sync" toggle.** Rejected. This is the
current state with a switch on it, and the switch does not change that a device
can hold records the server lacks. It also makes every bug report begin with
"which mode were you in".

**A write outbox for offline writes.** Rejected, consistent with ADR-030 §1's
existing reasoning. Deferring writes means merging them later, and the merge is
the part that rots.

## ADR-035

**No Isolated Local-Only Data — Closing the Migration Window**

### Status

**Superseded in part 2026-10-08 (#1152): the legacy claim is retired.**
Decision 2 (device rows are migrated on sign-in), decision 5 (what counts as
isolated) and every consequence about the migration window, `mayPrune`'s
legacy guard and `claimLocal` are withdrawn: `claimLocal`,
`legacyLocalData.ts`, `legacyMigration.ts`, the `legacy` cache origin and the
IndexedDB migrations are deleted. Nothing on a device is sent to the account;
an upgrade empties the cache and the server refills it. Decision 1 (anonymous
is anonymous) and decisions 3 and 4 (a body agrees with its row) stand;
`maintenance.repairContainers` ran once against production and was deleted
(#1132). Read the rest of this record as history.

**Accepted and delivered.** The exemption is gone from `backendForMode`, the
migration runs from the root of the app, and `claimLocal` now writes a body whose
container agrees with the row it lands in.

**Partially supersedes [ADR-034](#adr-034)** — its
consequence that "declining the claim is a terminal choice, by design", and the
*offered, not automatic* rule that consequence rests on. Nothing else. ADR-034
remains the governing ADR for all three of its decisions: persistence requires an
account, Convex is the only source of truth, both apps are ordinary installable
PWAs. This ADR does not weaken any of them — it removes the one thing still
preventing the second from being true.

Re-affirms [ADR-032](#adr-032) without changing it. A
migrated build is **not** published: it lands on its owner's own shelf with
`publicRead` untouched and off.

**Amended 2026-10-06: the signed-out banner was removed at the product owner's
request.** Signed out, `AccountReconciler` now renders nothing. Read decision 2's
signed-out sentence ("says what is on the device and offers both doors"), the
export "beside the sign-in prompt, on every screen", and the consequences that
describe a count and two doors as history. The signed-in migration is unchanged.
The Roster's "Download all" reads the store, not IndexedDB, and signed out
the store reads nothing. A signed-out visitor therefore has no way to download a
pre-account roster still on the device. Those rows are migrated on sign-in.

**Amended 2026-10-08: the reconciliation runs until it completes, not on every
load (#1129).** It used to decide "pre-account roster" by counting rows at boot.
A signed-in browser's cache is full of rows, so every load re-ran the migration.
It then re-claimed any cached build deleted on another device, because
`claimLocal`'s `appIdTaken` finds no row to stop it. A second account on the
same browser was handed the first account's cache as its own work. The answer
now lives in the v18 `meta` row (`apps/itun/src/lib/db/cacheMeta.ts`). Only an
upgrade from before v18 that found a roster records `legacy`, and a completed
migration records `cache` and the account. The cache belongs to one account:
sign-out and a change of account empty it, except while it is `legacy`. Read
decision 2's "on every load" and the consequence on idempotence with this in
mind. The device-export helpers the earlier amendment left behind
(`buildLegacyExportBundle`, `ExportAllButton`'s `deviceRows`) were deleted.

### Context

ADR-034 was reported delivered, and its decisions were. Its *invariant* was not.

**A user had a roster that was present signed out and absent signed in.** Not a
sync delay — a stable, reproducible state of the product. That is precisely the
"second source of truth" ADR-034 exists to remove, alive in the shipped app
months after the flip.

Two independent defects produce it, and each is sufficient on its own.

#### 1. The migration window never closed

The flip could not simply send every anonymous visitor to the in-memory backend:
years of Solo users had rosters in IndexedDB, and the memory store is empty, so
they would have opened ITUN and found nothing. `legacyLocalData.ts` is the guard
that was added for them — a browser holding a roster kept the durable local
backend "until the user takes the claim or exports. That is the migration
window, and it closes per browser rather than on a date."

**Nothing ever closed it.** The probe had three states and no code path
anywhere set it to `absent`; it could only ever be `unknown` or `present`. So the
guard did not open a window, it made the durable local backend **permanent** for
anybody who had ever built anything — which is every returning user.

The only path off the device was `ClaimLocalData`, and it could not carry that
weight:

- **It lived on the Account screen.** A player had to go looking for it. Nothing
  on the Roster — the screen where their builds were missing — mentioned it.
- **It could be dismissed forever**, per ADR-034's terminal-decline rule.
- **It counted the entity store, not IndexedDB.** For a signed-in player that
  store is filled from the server by `ShelfSync`. Once a sync had run, the card
  read a full account, computed `total === 0`, rendered `null` — and the local
  rows sat untouched beside it, with the app now actively reporting there was
  nothing to migrate.

#### 2. A claimed build could arrive in the account and still be invisible

Migration v13 mapped every non-Default Workspace onto `gameId: <that workspace
id>`. Those ids name no Game that has ever existed — Workspaces were retired
before accounts shipped, so there is nothing for them to correspond to.

Signed out, nothing filters and `Roster` renders the pile whole, which is why
this was invisible for as long as it was. Signed in, `Roster` scopes to the
active container, and every such build is addressed to a Game the account is not
in. They vanish.

`claimLocal` did not fix this and could not have by accident: it inserts with
`gameId: null` in the **column** while storing the client's body verbatim, and
the client reads the **body**. So the row said shelf, the body said phantom Game,
and the client believed the body. A build could be claimed, owned, and
server-backed, and still not appear anywhere.

### Decision

#### 1. Anonymous is anonymous. There is no exemption

`backendForMode` no longer consults the legacy probe. An anonymous visitor
gets the `signedOut` backend, whatever that browser is holding: writes are
refused, and every store reads empty (`readableRows`), not IndexedDB.

This is not a withdrawal of ADR-034's promise that existing local data is never
destroyed — see decision 2, which is what makes it keepable. The rows stay on
disk. What ends is their status as a place the app *writes to*: a device is not a
container.

#### 2. The rows are migrated, not abandoned — and it runs by itself

Signed out, the app says what is on the device and offers both doors: sign in, or
download. Signed in, the reconciliation just runs, from the root of the app, on
every load, comparing IndexedDB against `entities.listMine` directly.

**The claim stops being an offer, and the decline is withdrawn.** ADR-034's
reasoning was that "uploading somebody's whole roster the instant they sign in is
a decision made on their behalf with their data", and that "signing in to look at
a friend's game should not thereby publish your own builds".

That reasoning describes a world with two legitimate homes for a build. ADR-034
itself ended that world; the sentence outlived the architecture it was written
for. Copying a shelf row into the account that already owns it is not
publication — nothing is shared, nothing becomes visible to anyone else, and
`publicRead` (ADR-032) stays off. Meanwhile *not* copying it is what produced the
bug in Context. Between a theoretical consent cost with no observable effect and
a demonstrated data-isolation defect, the defect wins.

**Export survives, and stays load-bearing.** It moves to where a person without
an account will actually meet it: beside the sign-in prompt, on every screen,
reading IndexedDB rather than the store — because for an anonymous session the
store reads nothing, and the old export button would have handed somebody
downloading their pre-account roster an empty file.

#### 3. A row's body must agree with the row it is stored in

`claimLocal` shelves the body it writes. A claim lands on the shelf by
definition, so a body that names a Game is not a preference to preserve, it is a
disagreement with the row around it — and the client reads the body.

The general rule, for review: **wherever a container is expressed twice, the two
must be written together.** A record whose column and body disagree is
addressable by one reader and invisible to another, which is a worse failure than
either value being wrong, because nothing looks broken from either side alone.

#### 4. A body that already reached the account is repaired in place

Decision 3 fixes every body on the way in, and decision 2 sends everything the
account does not hold. **Neither reaches a build that was already claimed under
the old card**: the account owns it, so it is not isolated and nothing re-sends
it — while its body still names a Workspace that migration v13 turned into a
`gameId`. Owned, server-backed, and invisible.

So `maintenance.repairContainers` applied decision 3 to rows already in the
database, once, across every account (since deleted, with its workflow). The rule is `body.gameId := row.gameId`, and two
things about it are deliberate:

- **The column is the authority, not membership.** "Shelve anything whose Game I
  am not a member of" is a different rule and a destructive one — it would move
  a live campaign build onto the shelf. The column is what the server enforces
  container and ownership against; the body is the client record that drifted
  from it.
- **It is not gated on this browser holding a legacy roster.** The rows it fixes
  are in the account and may not be in this IndexedDB at all — claimed on a
  phone, opened on a laptop. A repair that ran only where the old rows happened
  to still sit would miss exactly the device the player is looking at.

Silent on failure, unlike the claim. Nothing is at risk: these rows are owned and
server-backed, so a failed repair leaves them as they were rather than losing
anything.

#### 5. What counts as isolated

A local row is isolated — and therefore migrated — unless one of these holds:

- **the account owns it.** `listMine` returns everything the caller owns in any
  container, so presence there settles it.
- **it is in a Game the account belongs to.** These are the rows `GameRoster`
  caches deliberately: a Game's unclaimed pre-gens and its communal crawler have
  no owner at all, so they are legitimately absent from `listMine` while being
  entirely server-backed. Migrating one would copy somebody else's character onto
  your shelf.

Everything else is isolated, **including a row in a Game that does not exist**.
That is the second defect above, stated as a rule: a container nobody can reach
is not a container.

**The client decides half of this and the server decides the other half**, and
the split is forced rather than chosen. "A Game the account is not in" is
ambiguous two ways, and they need opposite handling: a phantom Workspace id is
the caller's own build and must be migrated, while a Game the caller **left** is
somebody else's — `GameRoster.ensureLocal` (since removed) adopted a crewmate's
pilot into IndexedDB the moment you opened their sheet, and `rowMayBePruned`
prunes no Game row it cannot tell is the caller's, so that copy outlives the
membership.

The client cannot tell those apart and must not guess: shelving the second moves
another player's character into this account, and for an unclaimed pre-gen —
which carries no `appId` for the duplicate check to catch — it would actually
insert it. So `claimLocal` refuses any body naming a Game that genuinely exists
and reports it as `declined`. The answer never leaves the mutation, which
returns aggregate counts, so this discloses nothing a non-member could not
already infer — the same care `games.get` takes when it returns `null` rather
than distinguishing a deleted Game from one you cannot see.

`declined` is counted apart from `skipped` and `alreadyPresent` deliberately.
Those two mean "still only on the device" and are what decide whether the
migration is finished; a declined row is already safe on the server and was
never this account's to migrate, so counting it with them would hold the window
open forever — and `mayPrune` off with it — over rows that were never at risk.

### Consequences

- **The offer is gone, and with it the decline.** Somebody who signs in has their
  device rows moved into their account without being asked. This is the
  substantive reversal in this ADR and it should be read as one, not as a
  cleanup. It is accepted because the account is theirs, the destination is their
  own shelf, and the alternative is the state that produced the bug report.

- **A user who wants no account is now told so on arrival**, rather than
  discovering it. That is a real change in tone for the signed-out experience,
  and the download beside the prompt is what keeps it from being a wall.

- **A signed-out player can no longer browse builds this browser is holding.**
  Before, a returning Solo user opened the app and saw their roster. Now they see
  a count and two doors. This is the honest reading of "persistence requires an
  account" and it is the cost of having one source of truth rather than two.

- **Cache pruning arms only after a complete migration.** `mayPrune` requires
  `legacyLocalDataState() === 'absent'`, which a completed migration sets. The
  corollary is the guard: a migration that
  strands even one row leaves the state `present`, so a browser that cannot fully
  reconcile never prunes. Pruning off is a stale cache; pruning on too early is
  deleted work.

- **The reconciliation re-runs on every load until it completes, then never
  again on that browser.** Each pass is a query, a set comparison and at most
  one `claimLocal`. A pass that strands nothing records the close in IndexedDB
  (`meta.origin = 'cache'`), not in `localStorage` or module memory. A pass that
  strands a row records nothing, so the next load retries and the failed browser
  is still repaired. Re-running after the close would be wrong: the rows are
  then the account's cache, and any of them deleted on another device would be
  claimed back.

- **`claimLocal` must be safe to repeat**, because a browser retries it on every
  signed-in load until its migration completes. Every claimed kind matches on
  an identity, NPCs included (the id inside the body, like patterns).

- **The repair is a write against the account on every signed-in load.** It is
  one indexed read of the caller's own rows and, in the steady state, zero
  writes — but it is not free, and it is the price of reaching a population the
  client cannot enumerate. It converges: once a row agrees with its column the
  rule finds nothing, so it repairs each row once and then goes quiet.

- **`ClaimLocalData` is deleted rather than kept as a fallback.** A manual path
  beside an automatic one is a second answer to "did my roster arrive", and the
  manual one is the one that was wrong.

### Alternatives considered

**Fix the card instead: move it to the Roster, make it read IndexedDB, stop it
being dismissible.** Rejected. Each fix is correct and together they arrive at
"a prompt that appears on every screen, cannot be dismissed, and asks about
something the user has no reason to say no to" — which is a worse form of the
automatic migration, not an alternative to it.

**Keep the offer, but close the window on a date.** Rejected: it strands exactly
the users who did not engage with the prompt, which is the population the whole
mechanism exists for.

**Repair the phantom containers with a v16 IndexedDB migration.** Rejected as
insufficient rather than wrong. It would fix the rows on that one device while
leaving the same bodies already claimed into accounts untouched, and it does
nothing about rows that never reached the server. Decision 4 repairs the account
instead, which reaches every device at once — including ones that never held the
original rows.

**Load the device rows into the anonymous in-memory session so a signed-out user
still sees them.** Rejected, and it was the most tempting option — it preserves
the signed-out experience exactly. It also re-creates the defect in a new place:
session work is promoted as-is, without knowing what the account already holds,
so a sign-out/sign-in round trip would re-claim rows the account already had and
report them as builds that "could not be saved". `AccountReconciler` keeps the
rule this implies: device rows are sent only after comparing against
`listMine`, which only the signed-in path has.

## ADR-036

**Retire Snapshot Shares**

### Status

**Accepted, 2026-10-06.** **Supersedes [ADR-004](#adr-004)**
(snapshot sharing). [ADR-033](#adr-033)'s hosting decisions
are untouched; its §3, on the snapshot store, is history.

Amends [ADR-032](#adr-032): its consequence that
"ADR-004 is narrowed, not superseded" — snapshots kept as the way to hold a
frozen copy beside the live one — is withdrawn. Every other decision in ADR-032
stands, and the public sheet it introduced is now the only account-free way to
share.

**Decision 5 amended, 2026-10-08 (#1128):** the rendered unfurl image is
removed. The dependency audit gate that held it now passes a PR that changes
`bun.lock`, so the renderer went with `@resvg/resvg-wasm`; `/og/s/*` answers
404 rather than the 301 to the app icon this ADR first planned.

**Decisions 2–5 amended, 2026-10-09 (#1137):** old links no longer redirect,
and `/api/snapshots` is no endpoint at all.
Since this ADR shipped, `/s/:id` drew one hit and no identity lookup (three
`GET /api/snapshots/:id` in seven days), so the redirect-if-public path — the resolver, the read-only R2 seam, the `SNAPSHOTS` binding, the
per-snapshot unfurl metadata and a dev proxy — served nobody. `/s/:id` is now a
static retired page that reads nothing, and the consequences below that
describe the redirect, the identity endpoint or the unfurl text no longer hold.
This reverses the product owner's "Redirect if public" for links in the wild,
gated on the owner's count of how many stored snapshots name an entity that is
public today. With nothing left to route, ITUN moved to Static Assets'
`single-page-application` mode: navigations never reach the Worker, the CSP and
security headers moved into `apps/itun/public/_headers`, and the Worker script
answers only non-navigation misses — a missing hashed chunk 404s (#759), a
crawler gets the shell. The retired-URL 301 table went with it. The deleted
resolver: `git show 162f01ae:apps/itun/src/lib/snapshot/client.ts`.

Settles the four open decisions the unified-sheet-surfaces plan held for "a
future ADR-036", by removing the second surface rather than merging it. That
plan is deleted with this ADR:
`git show c2b31827:docs/architecture/unified-sheet-surfaces.md`.

### Context

ITUN had two account-free ways to share a sheet, and they were not
interchangeable:

- a **snapshot** (ADR-004, on a Worker and R2 since ADR-033): a frozen copy,
  minted per share at `/s/:id`, whose unguessable id was the whole capability —
  including the capability to delete it;
- the **public sheet** (ADR-032): a live, read-only page at `/p/:kind/:appId`,
  opt-in per entity through the `publicRead` Convex column, revoked everywhere
  by switching it off.

ADR-032 kept both because they "answer different questions": the frozen one was
to be "this pilot, as they were the night we lost the crawler". The
unified-sheet-surfaces plan then spent a document working out how to put the two
behind one surface, and found that it could not proceed without four decisions
— who owns a snapshot, whether a historical view stays unguessable, what
revocation means across two capability models, and what happens to `/s/:id`
links already in the wild.

The product owner answered the question underneath all four: **"Frozen sheets
probably shouldn't exist — we can just view the pilot in their current state."**
Offered the choice of keeping snapshots anyway, they chose to retire them. For
the links that already exist: **"Redirect if public."**

### Decision

1. **The public sheet is the only account-free way to share.** No surface mints a
   snapshot. The Share dialog manages the public sheet alone — on or off, its
   `/p/` link, a copy button and a QR of it — and says what sharing needs when the
   player is signed out or offline.

2. **There is no minting or revoking endpoint.** `POST /api/snapshots` and
   `DELETE /api/snapshots/:id` are gone: the collection answers 404 to every
   method, and the id route answers 405 to everything but GET. The edge rate
   limiter, which covered `POST /api/snapshots` and nothing else, goes with it.
   *Amended 2026-10-09 (#1137):* no `/api/snapshots` endpoint exists, by any
   method. `/api/snapshots` and `/api/snapshots/:id` are ordinary client-route
   misses: a navigation gets `index.html` from Static Assets, and a `fetch` gets
   the SPA shell with 200 from the Worker.

3. **An existing `/s/:id` link redirects if public, and otherwise is retired.**
   `GET /api/snapshots/:id` now answers only `{ kind, appId }`, read from the
   stored blob — every snapshot ever published is `{ kind, entity }`, and a client
   entity's `id` is the `appId` its server row is addressed by. `/s/:id` asks
   `publicSheet.get` (ADR-032's own unauthenticated query) about that entity: if
   it is public, the route replaces itself with `/p/:kind/:appId`; anything else —
   not public, never in an account, an unknown or malformed id, a build with no
   Convex — shows "This share link has been retired", which says to ask the owner
   for their live public sheet. The frozen copy is never rendered again.
   *Amended 2026-10-09 (#1137):* no link redirects; every `/s/:id` shows the
   retired page, and `/api/snapshots/:id` is gone.

4. **The R2 objects are kept untouched.** Nothing deletes them and nothing writes
   to the bucket; the Worker's storage seam is read-only. The `su-itun-snapshots`
   bucket and its `SNAPSHOTS` binding stay, because the redirect needs the read.
   The 365-day lifecycle rule that `wrangler.jsonc` recorded as decided but not
   yet applied (2026-09-01) is **withdrawn**: the store no longer grows, and
   expiring objects would turn redirectable links into retired ones.
   *Amended 2026-10-09 (#1137):* the `SNAPSHOTS` binding is removed, since
   nothing reads the bucket. The objects stay; deleting the bucket is the
   owner's step.

5. **Links already posted keep their unfurl text; the image is gone.** Snapshot
   links sit in Discord channels, and Discord re-fetches an unfurl, so the
   Worker still injects the shell metadata at `/s/:id` (`shellMeta.ts`) — a
   neutral title naming the entity and its kind, read from the stored blob, with
   no image. That text is the only thing the stored build still feeds; opening
   the link always goes through the redirect-or-retired resolver, never the
   frozen sheet. *Amended 2026-10-08 (#1128):* the rendered card at
   `/og/s/:id.png` was removed with `@resvg/resvg-wasm` — the renderer, the
   worker fonts, the since-deleted `scripts/woff-to-ttf.ts`, the `.ttf` Data rule and the
   `OG_METRICS` dataset — once `bun audit --audit-level=high` (with the gate's
   `braces` ignore) stopped failing a PR that changes `bun.lock`. `/og/s/*` is no
   longer routed: it is a missing file, and the Worker answers it 404. It served
   two renders in the seven days before that, none since this ADR shipped.
   Whether `/s/:id` should drop to the sitewide defaults is still open.
   *Amended 2026-10-09 (#1137):* it does. The Worker injects no metadata
   anywhere; every link unfurls with the shell's sitewide defaults.

How this answers the plan's four open decisions: (a) snapshots gain no owner and
no index — the entity they name is read off the blob per request, and only ever
used to reach a sheet its owner has already made public; (b) there is no
historical view to keep unguessable; (c) revocation is one model, `publicRead`,
and switching it off also stops old snapshot links reaching the sheet; (d)
existing `/s/:id` URLs are redirected where there is somewhere public to go, and
otherwise answer with a page that says what happened — which is what that plan's
governing rule asked of a link that can no longer serve what it served before.

### Consequences

- **There are no frozen sheets anywhere.** "This pilot, as they were" is no
  longer something the app can hand out. A player who wants that keeps an export
  (the Roster's "Download all", or a single entity's JSON export), which is a file
  and not a link.
- **Sharing needs an account.** `publicRead` is a Convex column, so a signed-out
  player cannot publish anything; the dialog says so and offers sign-in. Reading
  a public sheet still needs no account. Snapshots were the one way to share
  without signing in, and that way is gone on purpose.
- **Making a sheet public also re-opens its old snapshot links** — to the live
  sheet, not the frozen copy. That widens who can reach it beyond the people sent
  the `/p/` link, so the Share dialog says it in the same breath as what
  publishing exposes. Switching it off closes both at once.
  *Amended 2026-10-09 (#1137):* no longer true. Old links never reach a sheet,
  so publishing widens nothing beyond the `/p/` link, and the Share dialog no
  longer mentions them.
- **Some old links can never redirect.** A snapshot taken before its entity
  reached an account, of a build later re-imported (a copy gets a new id), or of
  an entity that was deleted, names an `appId` no public row has; it shows the
  retired page. So does every link while its entity is private — deliberately
  indistinguishable from "gone", as ADR-032 §4 requires of the public query.
  *Amended 2026-10-09 (#1137):* now no link redirects; every one shows the
  retired page.
- **A duplicated `appId` redirects to the oldest row.** `publicSheet.get`
  resolves duplicates the way `entities.byAppId` does. Where an id was duplicated
  across accounts, an old link could land on a different owner's sheet — but only
  one that owner chose to make public, so nothing private is disclosed.
  Collapsing a duplicate is a one-off repair run from the Convex dashboard's
  function runner, like every other repair.
  *Amended 2026-10-09 (#1137):* moot, since old links no longer redirect.
- **The browser cache still holds old answers.** `GET /api/snapshots/:id` used to
  return the whole blob with a year-long `immutable` Cache-Control. The client
  therefore reads either shape (`snapshotIdentity`), so a browser that opened a
  link before this change still resolves it. Those cached bodies contain the old
  frozen build; nothing renders them.
  *Amended 2026-10-09 (#1137):* the client no longer requests
  `/api/snapshots/:id` and `snapshotIdentity` is deleted, so nothing reads a
  cached answer either.
- **The Worker shrinks.** It no longer bundles the snapshot payload's Zod
  schemas, binds no rate limiter, and (since the decision 5 amendment) carries
  no resvg wasm, fonts or Analytics Engine dataset. ADR-033's open question —
  whether the og:image render fits the Free plan's CPU budget — was closed by
  removing the render, never measured: there is no publish step left to
  pre-render at, and nothing left to size.
- **An old link's preview names the build as it was.** The unfurl reads the
  stored blob, so it shows the entity's name and kind when the snapshot was taken,
  even while the entity is private and the link itself opens the retired page.
  Nothing more of the build is shown, and it is what that link already displayed
  wherever it was posted. It ends when `/s/:id` gets the sitewide defaults.
  *Amended 2026-10-09 (#1137):* it has ended. `/s/:id` unfurls with the
  sitewide defaults and names no build.
- **A still-open tab on an older build degrades honestly.** Its feature-detect
  read a 405 on `HEAD /api/snapshots` as "available"; it now gets a 404 and shows
  "publishing unavailable" instead of a button that cannot work. It also reports
  `snapshot service unavailable` to Sentry each time its Share dialog opens —
  expected noise that ends as those tabs reload onto the current build, not an
  outage. Its `/s/:id` page, handed `{ kind, appId }` where it expected a build,
  shows its own "Could not render snapshot" state rather than crashing.
  *Amended 2026-10-09 (#1137):* `/api/snapshots` is no endpoint, so that
  `HEAD` gets the SPA shell with 200, not a 404. The feature-detect read anything
  but 405 as unavailable, so the tab still shows "publishing unavailable". Its
  `/s/:id` page gets the shell where it expected a snapshot and shows its error
  state; a tab on the redirect build reports `snapshot-identity-failed` once and
  shows the retired page. Neither redirects.

### Alternatives considered

**Keep snapshots beside the public sheet** (ADR-032's position). Rejected by the
product owner: the frozen copy is not a thing players need, and keeping it meant
two capability models, two revocation stories and a merge plan blocked on four
decisions.

**Unify them behind a Current | Historical toggle** (the deleted plan's Option C).
Rejected with the frozen half: there is no historical view left to toggle to.

**Redirect every old link, public or not, to `/p/:kind/:appId`.** The public page
already says "This sheet isn't available" for a private one. Rejected because it
puts an entity's `appId` into the address bar for a sheet its owner never made
public, and because "isn't available" does not tell the holder of an old link
what changed. The retired page does.

**Serve the frozen copy at `/s/:id` forever, mint nothing new.** The cheapest
option for links in the wild. Rejected: it keeps a frozen sheet renderer alive
for the one surface the decision removes, and keeps publishing a build its owner
may have long since changed or wanted withdrawn — with no owner able to withdraw
it, since the id-as-revoke capability goes with the endpoint.

**Delete the R2 objects.** Rejected: the redirect needs them, and deletion is not
reversible.

## ADR-037

**The Assignment Model — Direct Links, Cardinality, One Container**

### Status

**Accepted.** Extends [ADR-030](#adr-030)
(Games, containers, ownership) with rules for the soft links that wire pilots,
mechs and crawlers together, and **amends ADR-030 §5a**: a Game no longer
waits for a crawler before it takes a player's crew (see *Moves* and *The
primary crawler*). ADR-030's container model — one nullable `gameId`,
the shelf as "My Stuff" — is the ground this stands on and is unchanged.

The rules are code in one place, `apps/itun/src/lib/links/linkRules.ts`, imported
by the client store and by `apps/itun/convex/` alike.

### Context

A soft link is an assignment: this mech carries this pilot, this pilot crews
this crawler. Three things were wrong with how they worked, and each one showed
up as a player-visible bug.

1. **A mech had no crawler of its own.** It reached one through its pilot
   (`mech-to-pilot`, then the pilot's `pilot-to-crawler`). A mech without a
   pilot was homeless, a mech followed its pilot wherever they crewed, and
   "assign this mech to the crawler" was not a sentence the model could say.
2. **Nothing bounded how many.** A pilot could crew two crawlers and a mech fly
   two pilots; readers took whichever `links.find` met first. Only the
   Dashboard chooser removed conflicting links, and only its own.
3. **Nothing kept both ends together.** The server validated the `from` end
   (permission, container) and stored `to.id` as a free string. A pilot on a
   shelf could be wired to a crawler in a Game, and moving an entity left its
   links filed where it used to be.

And the links never came back down. `listMine` returned none, `listForGame`'s
were read by nothing, and a Game's crawler — owned by nobody — was never in any
query the cache was filled from. So a pilot assigned to a crawler from one
device, or by a crewmate, showed as unassigned everywhere else.

### Decision

#### Three link types, each one hop

| type               | from  | to      | from holds | to holds |
| ------------------ | ----- | ------- | ---------- | -------- |
| `mech-to-pilot`    | mech  | pilot   | ≤ 1        | ≤ 1      |
| `pilot-to-crawler` | pilot | crawler | ≤ 1        | many     |
| `mech-to-crawler`  | mech  | crawler | ≤ 1        | many     |

`mech-to-crawler` is new. A mech's crawler is its own link; there is **no
fallback** through its pilot anywhere — a mech with no direct link has no
crawler. Mechs and pilots are assigned independently.

#### Drawing a link replaces what it conflicts with

Assigning a pilot to a second crawler is a move, not an error. The conflicting
link (same `from`; or, for `mech-to-pilot`, same `to`) is deleted **in the same
write** that draws the new one — one Convex mutation (`writeSoftLink`), one
IndexedDB transaction (`entityStore.create('softLink')`).

Replacing a link drawn out of somebody else's mech — the other mech flying this
pilot — is allowed to the owner of that mech or of the pilot, and to nobody
else: the pilot's owner decides who flies them, the mech's owner what it
carries.

#### Both ends share one container

The same Game, or the same owner's shelf. "My Stuff" is a solo Game for every
purpose here: two players' shelves share the `null` game id, so the server also
compares owners. Drawing a link across containers is refused — by the client
store when it holds both ends, and always by the server, with a player-facing
`ConvexError`. A move prunes every link it would leave straddling two
containers and re-files the rest, server-side in the move mutation and mirrored
in the store.

A link's `gameId` column is its container, and moves with its ends.

#### Links and Game crawlers sync down

`entities.listWiring` returns every link drawn out of an entity the caller owns,
every link in a Game they belong to, and every crawler in those Games.
`WiringSync` (beside `ShelfSync`) reconciles it into the cache — server wins,
pruning only where the answer covers and only under `ShelfSync`'s prune guard.
Other members' pilots and mechs are **not** cached: they are read live and
read-only from `listForGame`, and a cached copy of somebody else's sheet is an
editor whose every save the server refuses.

#### Where each rule is enforced

| Rule                   | Server (authority)                                        | Client (mirror)                                   |
| ---------------------- | --------------------------------------------------------- | ------------------------------------------------- |
| type matches its ends  | `upsertSoftLink` (`endsMatchType`)                        | `createSoftLink` in `entityStore.ts`              |
| cardinality / replace  | `writeSoftLink` (`model/entities.ts`), used by every writer | `createSoftLink` (`conflictingLinks`)            |
| one container          | `upsertSoftLink` (`sameContainerRows`)                    | `createSoftLink` (`sameContainer`)                |
| move prunes            | `pruneLinksAcrossContainers` in `upsertByAppId`           | `pruneLinksAfterMove` in `entityStore.update`     |
| scrap/delete cascades  | `pruneLinksOfRow` in every remove path                    | `atomicWrite` with `pruneSoftLinks`               |

`assignLink` (`src/lib/links/assignLink.ts`) is the one client entry point:
type from the ends, rules in the store, a refusal surfaced as `LinkRefused`.

#### Moves

The server is the authority (`convex/entities.ts`); `moveDestinations` in
`apps/itun/src/lib/games/gameRoster.ts` mirrors it so `MoveToContainerControl`
lists only what would be accepted.

- **Pilots and mechs** — the owner moves them from My Stuff into any Game they
  are a member of, between Games, and back. The old gate ("a Game takes a
  player's crew once it has a crawler", ADR-030 §5a) is gone, for creating in
  a Game as well as moving in.
- **Crawlers** — only the table runner, and only between their own shelf and a
  Game they run (`entities.moveCrawler`): in, it becomes communal (`ownerId:
  null`); out, it becomes theirs. Game to Game is two moves. The mutation
  writes the row's `gameId`, the body's `gameId` and `ownerId` together; the
  field-level crawler patch strips any `gameId` it is sent, so the body can
  never name a container the row is not in.

#### The primary crawler

`games.primaryCrawlerId` (optional; absent means "the oldest crawler here").

- **Explicit link on entry.** A pilot or mech created in a Game, or moved into
  one, is assigned to the primary by a link the server writes as part of that
  add or move — an internal write, not subject to `upsertSoftLink`'s
  from-owner check. With no primary there is no link.
- **The first crawler picks up the crew.** A crawler raised in or moved into a
  Game with none becomes primary, and every pilot and mech already there with
  no crawler of their own is assigned to it.
- **Fallback.** A primary that is scrapped or moved out is replaced by the
  oldest crawler left, or none.
- **Changing it moves nobody.** The table runner may name another
  (`games.setPrimaryCrawler`, "Make primary" on the Game roster); only later
  arrivals go to it. Players may still reassign their own entities to any
  crawler in the Game.
- The Game summary's crawler name (`games.summary`), `listForGame`'s
  `primaryCrawlerId` and the Discord bot's crew board all read the primary
  (`primaryCrawlerOf`).

#### Existing data

Rows written before these rules were brought into line by a one-off repair,
run once against production and deleted (#1132).

### Consequences

- A mech moved without its pilot leaves the pilot's wiring behind, and vice
  versa: moving a pilot into a Game drops its link to a mech still on the shelf.
  That is the rule working, but it means moving a pair is two moves and a
  re-assignment.
- Template-seeded rows carry no `appId` and share body ids across every Game
  seeded from the same template. Link resolution falls back to a body-id match
  inside the link's own Game, and conflict checks are scoped to the container,
  so those Games keep working; the rows remain unaddressable by the ordinary
  mirror, which is a separate defect.
- `listWiring` reads the caller's own pilots and mechs to find their links, so
  it re-runs on their edits. The reconcile is idempotent and writes nothing
  when nothing changed.
- A Game that predates `primaryCrawlerId` has its oldest crawler as primary;
  the first crawler event there writes that down. Nobody already in such a
  Game is auto-assigned — the backfill runs only when a Game gets its first
  crawler.

## ADR-038

**The Dashboard Is a Game Surface with Shared Play State**

### Status

**Accepted; built.** Every decision below is in code; the Dashboard as built
is [dashboard.md](architecture/dashboard.md). One consequence fell short:
Tailwind-removal P5 (below).

This is the one Dashboard decision record. **It supersedes [ADR-015](#adr-015)**
and the five sub-decisions merged into it (ADRs 016–020): §6 to §9 restate the
ones that stand, Major and Minor slots replace the rotary Dial (§3), and play
state moves from the device onto the Game (§2).

**Also amends:**
- [ADR-030](#adr-030) §5: the table runner alone edits a Game's crawler.
  §6: crew status reaches the Dashboard as a Crew tab, not a dial item.
- [ADR-029](#adr-029) §4: activated
  effects resolve against the seat, not ephemeral play state.
- [ADR-034](#adr-034)'s "What is not data": mount
  state is no longer a device preference.

The Dashboard is the Guided Play surface of [ADR-021](#adr-021)'s taxonomy, and
delivers part of its long-tail "shared, live Dashboard": each player's play
state is visible to the crew live. It does not put several players on one
screen.

### Context

ITUN's live sheet fuses two moments with opposite interaction grammars: editing
a character (inline edit and scroll) and running it at the table (one screen,
no scroll, every action a button). Forcing both into one surface produced
clutter, so the Dashboard was built as a surface of its own.

It was built for one player on one device. Its play state (boarded or not, the
range band, activated effects, the Downtime step) reset on reload and was
invisible to crewmates and to the same player's other devices. It launched
from the shelf and in anonymous play as readily as from a Game, and a rotary
Dial hid every entity but one, so a boarded player rotated it to check their
pilot's HP.

Since then, Games became the server of record (ADR-030). They have a Mediator
role, a shared Downtime row, crew vitals, proposals and alerts, and Convex as
the only persistence (ADR-034). The product owner wants the Dashboard to be a
curated, live game experience: an in-game sheet that puts every tool in reach,
reads at a glance and, eventually, syncs Mediator and player actions such as
Downtime steps.

### Decision

#### 1. The Dashboard is Game-only and needs a Mediator

The Dashboard opens only for a pilot in a Game that has a Mediator. A solo
player can make themselves Mediator of their own Game. Shelf pilots, anonymous
sessions and Games with no Mediator get no Dashboard. Those players use the
live sheet, editing it by hand, including for Downtime. A disconnected session
keeps an open Dashboard read-only, as the sheets do. It launches
only from the Game hub, which asks just for the pilot.

The Dashboard is for pilots. A Mediator who plays a pilot uses it like anyone
else. A Mediator Dashboard is a separate, later decision.

#### 2. Play state is a seat, saved on the Game

There is one **seat** per pilot in a Game, held in Convex. It records:

- **mount:** on foot, or boarded and in which mech;
- the **range band**;
- the **activated effects**;
- the **action being resolved**, so a reload mid-roll keeps it and the crew
  watches it step by step;
- whether the pilot **ejected**, until the next Board or Dismount.

Its rules:

- **It is keyed on the pilot, not the member.** ADR-030 §4 lets one member
  cover for an absent player, so one member can run two seats.
- **Only someone who may write the pilot writes the seat.** Boarding also
  needs write access to the mech, because playing a mech writes its Heat, EP
  and SP. The Mediator does not write seats. They propose, as everywhere else
  (ADR-030 §4).
- **Every member reads every seat.** A seat holds nothing a crewmate isn't
  entitled to see.
- **Mount never becomes a field on a pilot or mech.** It can't leak into sheets
  or public sheets. A seat is its own record that points at them.
- **"In Downtime" is not stored on the seat.** It comes from the Game's
  `downtime` row.
- **Rolls go to the Game's change log** as Game rows, the same form the Discord
  bot already writes, and the crew reads them as a log.

Only the arrangement of one player's screen stays on the device: the open tab,
deck filters, and open overlays and menus.

#### 3. Major and Minor slots replace the Dial

The top of the Dashboard is one **Major** slot and two **Minor** slots. Who holds
Major follows the game, and nothing else moves the slots:

| When | Major | Minor | Minor |
| --- | --- | --- | --- |
| On foot | Pilot | Mech | Crawler |
| Boarded | Mech | Pilot | Crawler |
| Downtime | Crawler | Pilot | Mech |

- **A Major shows that entity's full controls.** Rarely used controls go in a
  narrow side column: the mech's Effects and Egress, and the crawler's Upkeep,
  Upgrade and Scrap a mech.
- **A Minor shows only what needs watching**, and more only when something is
  wrong.
- **⤢ opens any entity's full controls** without moving the slots.

Boarding is a split button: the main half boards the pilot's assigned mech, and
the menu lists every mech assigned to the pilot's crawler.

#### 4. The display is tabbed, with Crew and Log

The display panel has Resolve, Reference, Tables and SRD as primary tabs, with
Log and Crew as secondary tabs.

- **Crew** shows every crewmate's pilot. It adds their mech's numbers when
  their seat says they're boarded, and it flags anyone who needs attention.
  The server derives those numbers and that status from the stored records,
  so every client agrees and nothing extra is stored.
- **Log** shows the Game's rolls and the Mediator's alerts.

#### 5. Downtime follows the Game

The Mediator starts, advances and ends Downtime, as `downtime.begin`, `advance`
and `end` already allow. Every player's Dashboard follows: the Crawler takes
Major and the step guide replaces the action deck. Each player marks their own
step done. The Dashboard keeps no Downtime step of its own.

**A Game's crawler is the Mediator's.** Only the Mediator changes it, in
Downtime and out. That covers Salvage, Craft, Trade, Upkeep, Upgrade, damage
and Scrap a mech. Players see the crawler read-only and ask at the table. The
server enforces it (`assertMayEditCrawler`, `downtime.spendUpkeep`); with no
Mediator, the Organizer keeps it (`requireTableRunner`).

**Boarding never assigns.** Boarding a mech, a spare included, changes only the
seat, never the pilot's `mech-to-pilot` link.

#### 6. A surface of its own, sharing the sheets' state

The Dashboard is its own surface at `/dashboard/$pilotId`, not a mode of the
live sheet. The sheets edit a character (Free Edit); the Dashboard runs it at
the table (Guided Play). Both read and write the **same** records through the
**same** store and rules engine ([ADR-006](#adr-006), [ADR-003](#adr-003)):
the Dashboard is a second lens, not a second source of truth. Every control
obeys [ADR-007](#adr-007): non-destructive bookkeeping (EP, Heat, uses, SP)
auto-applies, and destructive change (destroying an item, Eject, meltdown) is
the player's confirmed act. A player never writes another player's state.

#### 7. Reuse the SRD display; the instruments are bespoke

The display renders the same `component-lib` entity display the rest of the
app shows (`ReferenceEntityCard`, `RollTable`), with entity-level
interactivity passed as typed `controls`. Only the instruments (gauges, bays,
slots, buttons) are Dashboard components. One display system means one place
to fix reference rendering.

#### 8. Flat and inset; only the display reads forward

Instrument surfaces read **recessed** (a mild inset shadow, soft
entity-tinted borders), and buttons are flat recessed keys. **The display is
the one element that reads forward** (a solid hard border, no inset). Hue
encodes ontology, never identity; state is a treatment overlay (hatch, strike,
redline), never a second hue.

#### 9. A fixed 1280×800 canvas, scaled to fit

The Dashboard is a fixed 1280×800 design canvas scaled with one
`transform: scale(min(vw/1280, vh/800))` and letterboxed. "Always one screen,
never scrolls" is a **landscape-desktop contract**. Below a width threshold
the canvas is abandoned rather than shrunk illegibly; the phone layout built
from the same instruments is a follow-up, and until then that host gets a
rotate-to-landscape notice.

### Alternatives rejected

- **A "play mode" toggle on the sheet.** The layouts are irreconcilable in one
  component.
- **A separate app.** It duplicates the data layer and breaks single-store
  consistency.
- **Keep play state on the device and broadcast it to the crew.** It would still
  be lost on reload and on a second device. It would also create a second source
  of truth beside Convex, which ADR-034 rules out.
- **One seat per member.** It breaks the moment a member covers a second pilot.
- **Mount as a field on the pilot or mech.** It would leak into sheets and
  public sheets.
- **Keep the Dashboard on the shelf and in solo play.** The product owner
  rejected this. The Dashboard is a curated live game, and the live sheet already
  serves solo play.
- **The Crawler always in a Minor slot.** During Downtime the crew acts through
  the crawler, so it takes Major.
- **A Dashboard-specific action renderer** that forks the display, rather than
  §7's reuse.
- **Skeuomorphic 3D dials, a CRT bend, per-source colour chips** that let hue
  mean identity, rather than §8.
- **A fluid responsive grid**, which cannot guarantee no-scroll, and scaling
  with no floor, which fights browser zoom and is illegible on phones, rather
  than §9.

### Consequences

- **Fewer people can use the Dashboard.** Anonymous visitors, shelf play and
  Games without a Mediator have none, as [data flow](#data-flow) and
  [combat loop](#combat-loop) say.
- **There is server surface.** A `seats` table and its functions. Seats are
  cleaned up when a Game, pilot or account is deleted and when a pilot or mech
  leaves the Game. Every toggle is a mutation, so the client uses optimistic
  updates.
- **An open Dashboard subscribes to more.** It watches the seats, the Game's
  rolls and the Downtime row (ADR-030 counts an open Dashboard as a live
  subscription).
- **The Dashboard's Tailwind-removal phase was to be absorbed.** The
  components use style objects and add no `.pc-*` class, but 103 `.pc-*`
  classes remain, so [tailwind-removal.md](design-system/tailwind-removal.md)
  P5 is still open.
- **Players cannot edit a Game's crawler,** on the Dashboard or the sheet.
  Until players can send requests to the Mediator in the app, they ask at the
  table.
- **Convex has the rules package** for crew status. ADR-006's rule holds: the
  math stays in the package, and Convex calls it.
- **Follow-ups:** a Mediator Dashboard (#1062), the phone layout (#1063), what
  "claiming" a crew asset means in a Game (#1064), and the bot reading
  server-derived crew status (#1068).

## ADR-039

**Addressed Invites — by Discord Account**

### Status

**Accepted.** Extends the invite amendment of
[ADR-030](#adr-030) — an invite already
carries a seat, a hand-out and an optional approval door; it may now also carry
an **address**: one Discord account. Bearer codes are unchanged and remain the
default.

Built in two layers, each its own PR: the model and the invitee's side
(`convex/model/invites.ts`, `invites.redeem` / `decline` / `forMe`, the hub's
Invitations card), then `/su invite @user`, verified by Discord's own
signature.

### Context

Every invite was a code. The Organizer minted one, then delivered it by hand —
read aloud, pasted into a DM, posted in a channel — and anyone who held it
could spend it. That is the right tool for a table that is already sitting
together, and the wrong one for "I want Sam in this game": the Organizer has to
leave the app to deliver it, nothing records who it was for, a leaked code
seats whoever finds it, and Sam has no way to say no.

The product wants a formal invite: pick a person, the app delivers it, the
person accepts or declines. The audience already lives in Discord, and Discord
is the only way to sign in, so a person is picked by their Discord account.

### Decision

#### 1. An address is a column on an invite, not a second invite system

`invites.target` is `{ kind: 'discord', discordId, name? }`; absent is a bearer
code. Everything else — the preview, `redeem`, `seat()`, grants, revoke, the
redemption log — is the same code path whichever door was used, for the reason
ADR-030's amendment gave for `seat()`: one implementation rather than two that
drift.

Both doors mint through `model/invites.ts#mintInvite`. They differ only in how
they prove the Organizer (a Convex token; a Discord-signed interaction), never
in what an invite is.

An addressed invite is:

- **Single use, always.** It is for one person; a second use would be somebody
  else. The Organizer cannot override this.
- **Good for a week** by default (a bearer code: a fortnight). It was delivered
  to the person directly and needs no fortnight of slack.
- **Declinable** — by its addressee, and only for an addressed invite: a bearer
  code may be meant for a whole table, and one person's no must not close it
  for the rest. Declining is terminal; revoked outranks declined.

#### 2. Who may redeem

Only the account signed in with that snowflake, read from `authAccounts`
exactly as `model/bot.ts#userByDiscordId` reads it the other way. The refusal
names nobody. **Approval is never required**: Discord has proven who will
redeem it, and the Organizer chose that person.

#### 3. `/su invite @user`, attested by Discord, not asserted by the bot

The bot's bearer credential (`ITUN_BOT_SECRET`) **asserts** a Discord id; the
[bot authentication](#bot-authentication) is explicit that
its holder can claim to be any linked player, and bounds the damage by what the
bot may do: read, record rolls, bind channels — and **never invent a
membership**. An invite command that trusted the asserted id would break that
bound: a leaked secret could pose as any Organizer and invite itself in.

So `/su invite` does not trust the bot. The bot forwards Discord's **signed
interaction** — the raw body, `X-Signature-Ed25519` and
`X-Signature-Timestamp` — and Convex verifies the signature against the
application's public key before it reads anything from the body. The
Organizer's id and the invitee's id are then **attested by Discord**. Convex
also rejects a stale timestamp and records the interaction id on the invite, so
a replayed or retried interaction finds its invite instead of minting another.
This is the bot-client doc's Option B, taken for the one operation that needs
it; the rest of `/bot/*` is unchanged.

The bot then DMs the invitee a link. A DM is **best effort** — Discord refuses
one when the bot and the invitee share no server, or the invitee has closed
their DMs — so failure is recorded on the invite (`delivery`), the Organizer is
told privately and given the link to pass on, and nothing is posted in the
channel on anyone's behalf.

**At most one DM per invite per day.** Re-running `/su invite` on somebody who
already holds a live invite re-offers its link to the Organizer, but the bot
does not DM them again until a day after the last one was delivered — so the
command cannot be used to make the bot message a person on repeat.

**The DM is not the only way the invite arrives.** Because it is addressed to
an account, the hub shows it to the addressee in an **Invitations** card
(`invites.forMe`) the next time they open the app. A failed DM costs nothing.

#### 4. Privacy

- **What the invitee sees before accepting** is what a link holder always saw:
  the Game's name, who invited them, the seat, how many characters are waiting,
  the expiry. Never the crew, the members, or entity names — ADR-030 §5
  visibility begins at membership.
- **No address-book harvesting.** An invitee is picked with Discord's own
  `@user` option. No contact import, no guild member listing, no autocomplete
  across accounts. Their handle is shown to the Organizer who picked them and
  to nobody else; the preview says only *that* an invite is addressed.

#### 5. Secrets

None new. The bot already holds `DISCORD_TOKEN`, which sends the DM, and
`DISCORD_PUBLIC_KEY` — set on the Convex deployment for the signature check —
is the application's public key.

### Not adopted: email invites

Inviting by email address (Resend, from a Convex action; the link redeemed by
whoever holds it) was designed, built and dropped by the product owner in
favour of Discord only. It would have made the app the holder of addresses
belonging to people who never signed up, and given Convex its first outbound
email dependency, for an audience that is already on Discord. The design is in
the closed PR #1047; if it returns, `target` is where a second kind goes.

### Consequences

- **Convex gains its first Ed25519 verification**, in the default runtime; it
  needs no Node.
- **The bot's write surface grows by one operation**, and that operation is the
  one the bearer credential cannot reach on its own.
- An invitee who declines must ask for a new invite to change their mind. That
  is deliberate: a decline the Organizer can see is worth more than a decline
  that might quietly reverse.

## ADR-040

**The Reference Dataset Is Served Verbatim and Has No Release Stream**

### Status

**Accepted; built** (2026-10-08, audit-4 P16, #1136). Supersedes
[ADR-025](#adr-025); amends [ADR-014](#adr-014) and [ADR-024](#adr-024).

### Context

[ADR-014](#adr-014) made srd's JSON API the dataset's only public interface.
By audit 4 that API broke its own contract three ways. `/schema/<id>.json`
re-serialised the models, so every row carried the `schemaName` that
`BaseModel` stamps on its copy, and every `/schema/<id>.schema.json` forbids
that key: 4 of 4 sampled datasets failed their own schema. Every schema's `$id`
named `salvageunion.com/schemas/…`, a host that times out. `llms.txt` taught an
item URL that 404'd.

[ADR-025](#adr-025)'s release stream for the package had stopped meaning
anything. Release-please attributes a squash commit to every component whose
files it touches, so the live changelog listed ITUN PRs under "Data v2.14.0"
and one PR twice; in 60 days only two refactor commits touched `data/`. Each
data release also redeployed ITUN and pushed Convex, and `deploy-surfaces.ts`
carried two narrowings (the CHANGELOG's readers, a version-only manifest bump)
for those commits alone.

Two tools wrote `data/*.json`: `edit-data`, which edits the text in place, and
`fix:ids`, which rewrote whole files with `JSON.stringify` against the data
rule.

### Decision

1. **The API serves the committed files.** `/schema/<id>.json` and
   `/schema/<id>.schema.json` are the package's `data/<id>.json` and
   `schemas/<id>.schema.json`, byte for byte, read through its `./data/*` and
   `./schemas/*` exports (`apps/srd/src/lib/referenceFiles.ts`). An item
   endpoint serves its committed row, without `schemaName`.
2. **A schema's `$id` is the URL it is served at**,
   `https://salvageunion.io/schema/<id>.schema.json`.
3. **No reference release stream.** The package is not a release-please
   component and has no `CHANGELOG.md`; its version is `0.0.0`, as
   `component-lib`'s is. A data change reaches users through the site that
   renders it.
4. **`edit-data` is the one writer of `data/*.json`.** `edit-data add` mints a
   missing `id`; `validate` reports and never writes.

### Consequences

- Dropping `schemaName` from served rows is a public-API change. A consumer
  that read it already knew the schema from the URL it fetched.
- `apps/srd/src/lib/__tests__/jsonApi.test.ts` validates every emitted dataset
  and item against its emitted schema, checks each `$id`, and checks that every
  concrete `/schema/…json` URL in `llms.txt` is an emitted endpoint.
- A data-only PR appears in neither site's changelog: each lists only its own
  scope ([ADR-041](#adr-041)).
- npm still serves the orphaned `salvageunion-reference@2.4.0`. Deprecating it
  needs the owner's npm credentials (`npm deprecate`), outside this repo.

## ADR-041

**The Deployed Commit Is the Release; Changelogs Read `main`'s History**

### Status

**Accepted; built** (2026-10-08, audit-4 P17, #1138). Supersedes
[ADR-024](#adr-024).

### Context

[ADR-024](#adr-024) derived each site's changelog from conventional squash
titles through release-please. By audit 4 that machinery cost more than the
changelog it produced. In the 30 days to 2026-10-08, 16 of 112 commits on
`main` were release commits, and 14 of the 16 release PRs merged within about
two minutes of opening: nobody curated them. Each one bumped
`apps/itun/package.json`, so each redeployed ITUN and pushed Convex for a
version string only ITUN's About page read. The stream also leaked: release-please
attributes a commit to every component whose files it touches, so the SRD's
changelog listed `feat(itun)` entries. Keeping it ran on a PAT in the
`production` Environment and a 108-line parser for release-please's markdown.

Nothing else consumed a version. Sentry tags every event with the deployed SHA
(`VITE_COMMIT_REF`, `SENTRY_RELEASE`), the deploy record is the
`deployed/cloudflare` tag, and a rollback dispatches a SHA.

### Decision

1. **The deployed commit is the release.** No app carries a version
   (`package.json` says `0.0.0`); ITUN's About page shows the build's short
   SHA (`VITE_COMMIT_REF`).
2. **Each site's changelog is `main`'s history, read at build time.**
   `readChangelog(scope, area)` (`packages/component-lib/src/changelog/gitChangelog.ts`,
   the `component-lib/changelog/git` export) runs `git log --first-parent` and
   keeps `feat`, `fix` and `perf` subjects whose scope is the app's own, one
   entry per day with each PR linked. srd calls it during its SSR pass; ITUN's
   `vite.config.ts` inlines the result as `__ITUN_CHANGELOG__`.
3. **The scope is the filter.** `feat(itun): …` appears on ITUN's page and
   nowhere else; `feat(srd): …` on the SRD's. An unscoped title, or one scoped
   to a package, appears on neither.

### Consequences

- No release PRs, no release commits, no PAT: `RELEASE_PLEASE_TOKEN` is no
  longer declared in `tools/environments.ts`.
- The deploy's build jobs check out full history (`fetch-depth: 0`). A shallow
  clone (CI, e2e) renders a shorter changelog, never a failed build.
- A site's changelog is as current as its last deploy. A scoped title that
  touched none of that app's deploy paths shows on the next deploy that does.
- A change to a site has to say so in its title. The PR title gate already
  requires a conventional title; it cannot know the right scope.
