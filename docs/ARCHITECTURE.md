# Architecture

The cross-cutting architecture of the SURef monorepo, one section per area:
what is true now, pointing at the source for anything that changes fast.
History is in git; the decisions behind it are the [ADRs](#decisions).

**Reading it:** Read ignores `#anchors`. Run `grep -n '^##' docs/ARCHITECTURE.md`,
then Read with an offset and limit for the section you need; never Read the
whole file.

Three docs stay separate: [architecture/dashboard.md](architecture/dashboard.md)
(the Dashboard as built; [ADR-038](adr/038-dashboard-game-surface.md) is its one decision record),
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
([ADR-014](adr/014-dataset-json-api.md), [ADR-040](adr/040-dataset-served-verbatim.md)). The package has no version or
release stream.

- **Entry points** `.`, `./rules`, `./zod`,
  `./testing`, each `types` and `default` on one `lib/*.ts` source (the
  `exports` map in `packages/salvageunion-reference/package.json`); no build.
  `./rules` is the pure rules math ([ADR-006](adr/006-rules-as-pure-functions.md)).
  `./zod` is the one Zod import ([ADR-013](adr/013-csp-compliant-zod.md)).
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

TypeScript source, no build ([ADR-011](adr/011-component-lib-ships-source.md)).
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
`Compositions/`. Internal on purpose: no `Tooltip`; `PeekCard` and `ConditionChip` are
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

Three connection modes ([ADR-030](adr/030-accounts-games-server-of-record.md),
[ADR-034](adr/034-persistence-requires-account.md)):

| Mode | Who | Truth | Reads | Writes |
| --- | --- | --- | --- | --- |
| **Solo** | not signed in | nothing | nothing of theirs | **refused** — sign in to build |
| **Connected** | signed in, online | Convex | reactive subscription | to Convex |
| **Disconnected** | signed in, offline | Convex | local cache | **blocked** |

Solo is read-only: building needs an account (ADR-034 decision 1, as
amended), so the Roster and the `/…/new` routes show a sign-in panel and the
store refuses an anonymous write. Solo has
no Dashboard: it opens only for a pilot in a Game with a Mediator
([ADR-038](adr/038-dashboard-game-surface.md)), so Solo play is on the live sheet. Offline,
a signed-in user is read-only and never falls back to IndexedDB, which would
fork data against the server of record. The mode comes from
`resolveConnectionMode()` (`apps/itun/src/lib/connection/connectionMode.ts`),
never `navigator.onLine` or an auth flag.

### IndexedDB cache

`apps/itun/src/lib/db/` via `idb` ([ADR-002](adr/002-indexeddb-zod-strict-reads.md)):
database `itun-v1`, `DB_VERSION` in `src/lib/db/index.ts`, stores in
`src/lib/db/stores.ts`: `pilots`, `mechs`, `crawlers`, `npcs`, `mechPatterns`,
`encounterNpcs`, `softLinks` and `meta`.

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
  a warning and refilled from Convex. Pilot, Mech, Crawler, Npc stamp
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
  (`src/lib/links/linkRules.ts`, [ADR-037](adr/037-assignment-model.md), [ADR-044](adr/044-built-npcs.md)),
  never across containers.

**Every store reaches Convex:** `commitEntityWrite` (pilots, mechs, crawlers, NPCs),
`commitTransfer` (a cross-entity transfer, one `entities.transfer` mutation)
and `commitSoftLink` from `entityStore.ts`, `commitPatternWrite` from
`patternStore.ts`, `commitNpcWrite` from `encounterStore.ts`,
and `commitChangeLog` from `entityChangeLog.ts` sends the Change Log, whose only
copy is the Convex `changeLog` table. `apps/itun/test/convex/containerParity.test.ts`
asserts each store has a table and calls its commit; a new store needs both.
The Change Log commit is the one fire-and-forget write, and reports its own
failure. If the schema cannot say where a record lives, the schema moves. No change may
leave data reachable from fewer places than before; a gate asserts the row is
in Convex, not the mechanism.

### Zustand stores

`apps/itun/src/stores/` ([ADR-003](adr/003-zustand-hydration.md)).
`entityStore` (pilots, mechs, crawlers, npcs, softLinks) reaches persistence through
`dbStoreFor(type)`. `list(type)` hydrates
lazily, then reads synchronously. `update()` validates, commits to Convex
(remote only), writes the backend store, then `set()`s and emits the Change
Log; a refused write changes nothing. `entityStore.transfer()` moves value between entities in
one Convex mutation and one IndexedDB transaction. `activeContainerStore` is the current Game or Shelf. There is
no TanStack Query: reads are the hooks in `src/hooks/entities/` and
`convex/react`; do not add a query cache.

### Sharing

The one account-free share is the public sheet
([ADR-032](adr/032-public-read-only-sheets.md)): `/p/:kind/:appId`, opt-in
through the `publicRead` column, read by `publicSheet.get`, toggled in
`ShareStatusDialog` → `PublicSheetPanel`. Snapshots are
retired ([ADR-036](adr/036-retire-snapshot-shares.md)): `src/routes/s/$id.tsx` is a static page saying
so, and reads nothing.

## Accounts and Games operations

Procedures (setting a deployment up, the sign-in probe, rotations, error
reporting, one-off repairs): the
[`convex-ops`](../.claude/skills/convex-ops/SKILL.md) skill. Values here are
public; secrets live only on the deployments.

|  | Production | Staging ([preview slot](#preview-deploys)) |
| --- | --- | --- |
| Deployment | `exuberant-porpoise-183` | `perfect-donkey-72` (cloud dev) |
| Client URL (`VITE_CONVEX_URL`) | `https://exuberant-porpoise-183.convex.cloud` | `https://perfect-donkey-72.convex.cloud` |
| HTTP actions (`VITE_CONVEX_SITE_URL`) | `https://exuberant-porpoise-183.convex.site` | `https://perfect-donkey-72.convex.site` |
| `SITE_URL` (the **frontend** origin) | `https://intheunionnow.com` | `https://preview-su-itun.alxjrvs.workers.dev` |

Project `alex-jarvis:suref-itun`
([dashboard](https://dashboard.convex.dev/t/alex-jarvis/suref-itun)). The
production origin is `https://intheunionnow.com`, never a `workers.dev`
host. `apps/srd` has no accounts.

Local development has no cloud deployment. `bun run dev:itun` runs a **local**
deployment (`convex dev --start vite`) and signs in through the test seam,
`ITUN_TEST_AUTH` on the local deployment and `VITE_TEST_AUTH` in the dev
server, not Discord. One-time setup: the
[`convex-ops`](../.claude/skills/convex-ops/SKILL.md#local-backend) skill.
Staging, the cloud dev deployment, is pushed only by `deploy-preview.yml`.

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
leaves the bot token alone. Its redirect URIs are production's and staging's
(`@convex-dev/auth` mounts `/api/auth/callback/` plus provider id `discord`):

```
https://exuberant-porpoise-183.convex.site/api/auth/callback/discord
https://perfect-donkey-72.convex.site/api/auth/callback/discord
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
([ADR-021](adr/021-itun-surface-taxonomy.md), governing;
[ADR-022](adr/022-change-log-and-stat-overrides.md)). The border is
**lifecycle transactions**: changes gated by a cost or procedure. Mode names
are ours.

| Mode | Surface | Stance |
| --- | --- | --- |
| **Guided Creation** | Wizard (`/*/new`) | Builds a legal entity; enforces and teaches creation rules |
| **Free Edit** | Live Sheet (`/sheet/:kind/:id`) | Edits _state_, never runs _transactions_ |
| **Guided Play** | Dashboard (Pilot + Mech + Crawler) | Enforced play whose layers teach as they enforce |
| **Frozen** | View (`/p/:kind/:appId`, a crewmate) | Read-only; evaluates nothing |
| **Adjudicate** | Mediator Dashboard (`/mediator/:gameId`) | GM tooling; reaches players only by proposal |

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
[ADR-007](adr/007-automation-boundary.md): the trigger fires, bookkeeping
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
[ADR-038](adr/038-dashboard-game-surface.md)). The Live Sheet is
Free Edit plus the list above, with cap overrides and revert. Place a feature
by mode, then rule class; resolve an ambiguous case here before building, and
update the matrix when a border moves.

## Combat loop

ITUN is a shared living sheet, not a game engine: play state moves through the
Zustand stores, with no combat RPCs, no turn enforcement and no undo (the
`changeLog` is provenance). Each player updates their own mech. Rules math is
pure and shared ([ADR-006](adr/006-rules-as-pure-functions.md)); bookkeeping
auto-applies, destruction waits for the player
([ADR-007](adr/007-automation-boundary.md)). Without a Game and a Mediator
([ADR-038](adr/038-dashboard-game-surface.md)), play is on the live sheet.

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
patches. Dice: [ADR-006](adr/006-rules-as-pure-functions.md).

**Activation:** the Dashboard's `useActionsDeck.ts` over `activationPatch()` in
`apps/itun/src/components/dashboard/dashboardRules.ts`; cost from `itemEconomy()`
(`sheet/mechItemRules.ts`) per action via `economyForActivation()`. Boarded,
the deck is the mech's chassis, systems and modules plus the pilot's abilities
and equipment; on foot, the pilot's alone. Each `PlayAction`'s `currency`
decides EP (adds Heat, can Push) or AP. One sequential write-through
([ADR-008](adr/008-sequential-client-mutations.md)): deduct `currentEP`,
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
([ADR-009](adr/009-item-condition-model.md)); `1` is confirmed.
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
[ruleset](design-system/ruleset.md); [ADR-026](adr/026-entity-card-design-rules.md).

**Two card shells, not merged.** `ReferenceEntityCard`
(`packages/component-lib/src/components/referenceEntity/card/ReferenceEntityCard.tsx`)
renders every entity's Card and Page in both apps and owns recursion (bounded by
`MAX_DEPTH`); body sections are components beside it in `card/`, pure rules in
`cardCells.ts`, `bodyBlocks.ts`, `cardChrome.ts`, `nestedSections.ts`, and
nesting sections take a `NestedCard` prop. `Card`
(`packages/component-lib/src/components/shared/Card.tsx`) is the generic
four-band container (`ModalShell`, `SheetSectionCard`, `Callout`, `Skeleton`,
app panels). The entity card does not render through `Card`; never add entity
features to `Card`. Not merged: fills, header slot and `cardClick` fallback differ. They share `displayMode`, the controls contract,
`CardFootMeta` and `foldStatusControl`. Grids are `MasonryColumns` of ITUN's
`EntityGridRow` cells. Never hand-assemble a `label | value` readout: that is `Stat`
(ruleset §3.7).

**Entity forms** ([EDL](design-system/entity-display-language.md)):
`<Entity form>` and `<Mention>` in `packages/component-lib/src/entity/`, from
`toEntityModel`; `EntitySurfaceProvider` gives `hrefFor` and `openPage`
once; each app mounts one `PeekHost` for `data-peek` triggers.

**Sizing:** `size` (`large | medium | small`) × `extent`
(`full | head | catalog`) in `packages/component-lib/src/components/shared/displayMode.ts`,
resolved by `resolveCardDisplay`, projected by `displayBooleans`. Never add a
`compact` / `listing` prop. `depth` 0 is solo; deeper ones tighten.

**Anatomy** is ruleset §5: fill by `isDoEntity`, actions `inline`, the facets
row in `card/CardFacets.tsx` (E17), trays in `card/NestedCards.tsx`;
`texture={false}` flattens a card; a page's body is `card/CardPage.tsx`.

**Controls:** `ReferenceEntityControl` (`referenceEntityControlTypes.ts`)
through `CardControlRail`; `stepper`, `badge`, `status`, `href` render their
primitive, so the footer is meta only. `cardClick: true` makes the card
clickable; `hidden: true` keeps it off the rail; `pennant: true` makes the
cost pennant the button. The one preset is
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
([ADR-010](adr/010-choices-in-shared-display.md)); ITUN wires it
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
`?story=<story-id>`; it opens on `foundations--styleguide--overview`.
Story rules: [`packages/component-lib/CLAUDE.md`](../packages/component-lib/CLAUDE.md),
enforced by `src/story-coverage.test.ts`; typecheck is what proves a story
compiles.

- `catalog.tsx` preloads the reference data before it imports any story
  module, and frames every story on the paper canvas; stories add no outer
  `bg-paper`.
- `src/styles/catalog.css` imports `tailwind.css` and srd's `pages.css`, and
  adds `@source` for the stories and the two apps' component folders.
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

An authenticated client of ITUN Games ([ADR-030](adr/030-accounts-games-server-of-record.md)):
`/su me`, `/su games`, `/su shelf`, `/su crew`, `/su sheet`,
`/su game bind|unbind|info`, `/su invite` ([ADR-039](adr/039-addressed-invites.md))
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
without it). `src/lib/staticPaths.ts` drops meta schemas
(`src/lib/__tests__/staticPaths.test.ts`); routes are slugs;
`apps/srd/public/robots.txt` names the sitemap.

**Accessibility:** Biome's `a11y` group (`biome.jsonc`). Each app's
`e2e/a11y.e2e.ts` (`tools/lib/a11yScan.ts`: axe-core WCAG 2.2 AA plus
`best-practice`) scans the pages in `tools/a11y-baseline.json` and
`tools/a11y-baseline-itun.json` at desktop and as a Pixel 7; a stale entry
fails until a run with `A11Y_UPDATE_BASELINE=1`.
Landmarks: labelled `<nav>`s in `AppBar.tsx` (switcher, product nav, and a
breadcrumb trail shown once per width), `<main>` in `BaseLayout.tsx`,
`Footer.tsx`. One `<h1>` per page (entity pages pass `titleAs="h1"` from `EntityView.tsx`
to `EntityCardHeader`).
Clickable `Card`s are `role="button"`; search (`useSearchCombobox`) is a
combobox with `aria-activedescendant`; filter chips are `Badge as="button"`
with `aria-pressed`; `ModalShell` traps focus and a destructive
`ConfirmDialog` starts on Cancel; touch targets are 44px under
`@media (pointer: coarse)`, minis, chips and breadcrumb links through a hit area
(`touchFloor.test.ts`).

**Contrast:** tokens in component-lib's `src/styles/theme.css`
(`--color-rust` is the one action colour). Text on a tone band is `onToneText`
(`packages/component-lib/src/design/contrast.ts`); `design/contrast.test.ts`
holds sub-headers and footers at 4.5:1, header tones at 3:1.

## CI and deploy

`.github/workflows/ci.yml`, `pr-title.yml`, `codeql.yml`,
`deploy-cloudflare.yml`, `deploy-preview.yml`. Workflow comments say what; this says why.

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
ships, never production itself; it bundles the Worker (`bun --filter itun
worker:bundle`). ITUN's full browser suite is nightly (`e2e-nightly.yml`). `build-discord-bot`
and `build-su-assets` bundle Workers. wrangler is
one root devDependency that all four Worker apps run; keep each `wrangler.jsonc`
`compatibility_date` at or below its bundled workerd.

### CI: PR title

The squash title is the changelog entry ([ADR-041](adr/041-deployed-commit-is-release.md)). `pr-title.yml`
runs on `opened`, `edited`, `reopened`, `synchronize`, with no `if:` or path
filter (a required context), because `ci.yml` does not run on `edited`. The
squash body is the PR body (`squash_merge_commit_message: PR_BODY`).

### CI: aggregate gate

`quality-checks`, named `CI Success`, fails on `failure` or `cancelled`.
**Every job must be in its `needs:`** (`tools/check-workflows.ts`,
`aggregator`). The ruleset requires `PR title is a conventional commit`
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

### Preview deploys

`gh workflow run deploy-preview.yml --ref <branch>` publishes any ref (one
that carries the workflow) to one slot, `https://preview-su-srd.alxjrvs.workers.dev`
and `https://preview-su-itun.alxjrvs.workers.dev`; last dispatch wins, and
the run summary names the commit. Each Worker gets a version under the
`preview` alias (`wrangler versions upload`), never a deployment. su-itun's
`preview_urls: true` turns on version URLs only; `workers_dev` stays off.

- **Backend:** staging, `perfect-donkey-72`. `ship` refuses any key but its
  `dev:` deploy key and an `ITUN_TEST_AUTH=true` there, pushes `convex/` and
  sets `SITE_URL` to the preview origin.
- **Gate:** the `preview` Environment admits every branch, so its required
  reviewer, the owner, is what guards the Cloudflare token ([ADR-033](adr/033-hosting-on-cloudflare.md)).
  Setup: `bun tools/environments.ts --apply`, then its two secrets.
- **No browser Sentry** (no DSN); Workers report `SENTRY_ENVIRONMENT=preview`.
- **Staging data persists across branches.** A branch whose schema rejects it
  needs its tables cleared first (dashboard: `perfect-donkey-72` → Data).

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
| `salvageunion-reference`, `@randsum/roller` | Redirects: one copy each ([ADR-006](adr/006-rules-as-pure-functions.md)) |

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
the only escape hatches.

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

`gh` is preinstalled, REST only via the GitHub proxy: `gh pr`/`gh issue`
(GraphQL) get 403, branch deletions are refused; use `gh api` or
`mcp__github__*`. Cloudflare and Sentry use claude.ai connectors, `convex` an
anonymous local one; no route: report **unread**, ask for remote data.
Environment and rules text (attach private `su-rules`; multi-repo skips repo
hooks): [ops/cloud-environment.md](ops/cloud-environment.md). If `bun --version`
differs from the root `packageManager`, run with
`PATH="$HOME/.local/share/su-srd-bun/<version>:$PATH"` (where the setup
script puts it) and `bun install --frozen-lockfile`. Never fake a GitHub step
that has no route.

### Cloudflare

Everything runs here ([ADR-033](adr/033-hosting-on-cloudflare.md)), account
`alxjrvs@gmail.com`, shared with RANDSUM (accepted risk, ADR-033 §6).

| Worker | Serves | Bindings |
| --- | --- | --- |
| `su-srd` | `salvageunion.io`, `www.` | none (Static Assets) |
| `su-itun` | `intheunionnow.com`, `www.` (Static Assets, SPA) | `ASSETS`, `CONVEX_URL` |
| `su-assets` | `assets.salvageunion.io` | R2 `LP_ASSETS`, `IMAGES` |
| `su-discord-bot` | Discord interactions | secrets only |

R2: `su-lp-assets`, and `su-itun-snapshots`, which nothing binds since
[ADR-036](adr/036-retire-snapshot-shares.md)'s amendment (deleting it is the owner's call).
Zones `salvageunion.io` and `intheunionnow.com`. Only `su-srd` and
`su-discord-bot` answer on `alxjrvs.workers.dev`. `su-assets` caches its
responses with Workers Caching (`cache.enabled`). Re-derive with
`wrangler deployments list` and `apps/*/wrangler.jsonc`.
**Outside the repo:** Always Use HTTPS (both zones), the `www` → apex Redirect
Rule and per-zone Images Transformations; see
[configuration outside the repo](adr/033-hosting-on-cloudflare.md#configuration-outside-the-repo).

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
  `main`; the deployed commit is the release ([ADR-041](adr/041-deployed-commit-is-release.md)).

Re-derive: `claude mcp list`; Sentry MCP `find_organizations` /
`find_projects`; `bunx convex mcp start` → `status`.

## Decisions

One ADR per file in [`docs/adr/`](adr/), `NNN-slug.md`. Its front-matter
`status` (`proposed`, `accepted`, `superseded-in-part`, `superseded`) and
`supersededBy` come first; a superseded ADR is a tombstone pointing at its
full text in git. A new decision takes the next number; numbers are never reused.
