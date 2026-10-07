# Architecture

The cross-cutting architecture of the SURef monorepo, one section per area:
what is true now, pointing at the source for anything that changes fast.
History is in git and the ADRs.

**Reading it:** Read ignores `#anchors`. Run `grep -n '^##' docs/ARCHITECTURE.md`,
then Read with an offset and limit for the section you need; never Read the
whole file.

Five docs stay separate: [architecture/dashboard.md](architecture/dashboard.md)
(code milestone #7 is rewriting),
[architecture/dashboard-redesign.md](architecture/dashboard-redesign.md) (the
live plan its issues link), [architecture/npc-builder.md](architecture/npc-builder.md)
(a plan, so its unbuilt paths are exempt from the path check),
[design-system/ruleset.md](design-system/ruleset.md) (the design laws, cited by
section number) and [design-system/tailwind-removal.md](design-system/tailwind-removal.md)
(the live Tailwind-removal plan).

**Sections:** [Packages and contracts](#packages-and-contracts) ·
[Data flow](#data-flow) · [Accounts and Games operations](#accounts-and-games-operations) ·
[Rules and ITUN surfaces](#rules-and-itun-surfaces) · [Combat loop](#combat-loop) ·
[Display system](#display-system) · [Component catalog (Ladle)](#component-catalog-ladle) ·
[Discord bot as a Game client](#discord-bot-as-a-game-client) ·
[SEO and accessibility](#seo-and-accessibility) · [CI and deploy](#ci-and-deploy) ·
[Dependencies](#dependencies) · [Services and agent tooling](#services-and-agent-tooling)

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
([ADR-014](adrs/ADR-014-json-api-public-interface-npm-retired.md)).

- **Entry points** `.`, `./rules`, `./zod`, `./schema-definitions`,
  `./testing`, each `types` and `default` on one `lib/*.ts` source (the
  `exports` map in `packages/salvageunion-reference/package.json`); no build.
  `./rules` is the pure rules math ([ADR-006](adrs/ADR-006-pure-rules-logic.md)).
  `./zod` is the one Zod import ([ADR-013](adrs/ADR-013-csp-zod-jitless.md)).
  `./schema-definitions` (`getJsonSchemaDefinition`) keeps the ~783 KB JSON
  Schema corpus off the barrel; only srd's `/schema/[id].schema.json` endpoint
  imports it. `./testing` is test-only: `entityFixture(schema, fields)` and
  `malformed<T>(value)`, never `as unknown as SURef*`.
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
  model (`_install()`); idempotent; `isLoaded(id)`. Access before load throws
  `Schema "chassis" not loaded`; an unknown id throws `No loader found for
  schema ID`; valid ids are `dataLoaders` in
  `lib/generated/modelFactoryRegistry.generated.ts`. Loads are trusted: CI
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

TypeScript source, no build ([ADR-011](adrs/ADR-011-component-lib-source-no-build.md)).
Exports `.` (`src/index.ts`, the source of truth; never trust a count),
`./design/tokens`, `./styles/dashboard.css`, `./styles/index.css`,
`./styles/theme.css`. `src/design/tokens.ts` is a zero-import leaf for
consumers with no stylesheet (the itun og:image renderer); never copy a token
literal (`tokens.parity.test.ts`). Code only one app renders lives in that app
(`apps/itun/src/components/`, `apps/srd/src/components/`) until a second app
renders it; the Dashboard's `.pc-*` styles stay in `src/styles/dashboard/`.
Internal on purpose: no `Tooltip`; `EntityTooltip` and `ConditionChip` are
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
Convex (`apps/itun/convex/`). The itun Worker serves the one read left of the
retired snapshot API from R2.

### Tailwind source paths

```css
/* apps/srd/src/styles/global.css */
@source "../../../../packages/component-lib/src";
/* apps/itun/src/index.css */
@source "../../../packages/component-lib/src";
/* both, after it */
@import 'component-lib/styles/theme.css';
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

Three connection modes ([ADR-030](adrs/ADR-030-accounts-games-server-of-record.md),
[ADR-034](adrs/ADR-034-account-required-persistence.md)):

| Mode | Who | Truth | Reads | Writes |
| --- | --- | --- | --- | --- |
| **Solo** | not signed in | nothing | in-memory backend | in-memory |
| **Connected** | signed in, online | Convex | reactive subscription | to Convex |
| **Disconnected** | signed in, offline | Convex | local cache | **blocked** |

Solo writes vanish on reload unless the user signs in (`AccountReconciler`
claims them). A build with no `VITE_CONVEX_URL` is permanently Solo. Offline,
a signed-in user is read-only and never falls back to IndexedDB, which would
fork data against the server of record. The mode comes from
`resolveConnectionMode()` (`apps/itun/src/lib/connection/connectionMode.ts`),
never `navigator.onLine` or an auth flag.

### IndexedDB cache

`apps/itun/src/lib/db/` via `idb` ([ADR-002](adrs/ADR-002-indexeddb-idb-zod.md)):
database `itun-v1`, `DB_VERSION = 17` (`src/lib/db/index.ts`), stores in
`src/lib/db/stores.ts`: `pilots`, `mechs`, `crawlers`, `mechPatterns`
(immutable builds), `encounterNpcs`, `softLinks`, `changeLog` (autoIncrement
`seq`, `by-entity` index, append-only) and the retired `workspaces` (kept for
migrations v10/v13).

- `makeStore(getDb, schema, storeName, opts)` (`src/lib/db/crud.ts`) parses
  with Zod on write; reads use `schema.strip()` so a drifted record loses
  unknown fields instead of bricking hydration. Pilot, Mech, Crawler stamp
  `updatedAt`; SoftLink and MechPattern only `createdAt`.
- Stores are created in `openDB`'s `upgrade`; record rewrites are one file per
  version in `src/lib/db/migrations/`, registered in `migrations/index.ts`, run by `runMigrations()` in the
  `versionchange` transaction, so a throw aborts the whole upgrade.
- `deleteEntityWithSoftLinks()` removes an entity and its links in one
  transaction.

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
  `'memory'` (anonymous or no Convex URL) or `'blocked'` (throws
  `WritesBlockedOffline`; surfaces check `canWrite`). In `'remote'`,
  `commitEntityWrite()` and its siblings write by app id (`appId` column) and
  are **awaited**: a refused write did not happen.
- Connected surfaces (`src/components/games/`, `src/components/account/`,
  `src/components/container/`) read with `useQuery` from `convex/react` under
  `AppConvexProvider`. The cache fills from `entities.listMine` and
  `entities.listWiring` (`ShelfSync` and `WiringSync`, both in
  `src/components/account/ShelfSync.tsx`): server wins, one prune guard
  (`lib/db/pruneRules.ts`). Links go through `assignLink`
  (`src/lib/links/linkRules.ts`, [ADR-037](adrs/ADR-037-assignment-model.md)),
  never across containers.

**Every store reaches Convex:** `commitEntityWrite` (pilots, mechs, crawlers)
and `commitSoftLink` from `entityStore.ts`, `commitPatternWrite` from
`patternStore.ts`, `commitNpcWrite` from `encounterStore.ts`,
`commitChangeLog` from `entityChangeLog.ts`. `apps/itun/test/convex/containerParity.test.ts`
asserts each store has a table and calls its commit; a new store needs both.
The Change Log commit is the one fire-and-forget write. If the schema cannot
say where a record lives, the schema moves; nothing is local-only. No change may
leave data reachable from fewer places than before; a gate asserts the row is
in Convex, not the mechanism. An anonymous user's way out is export to file.

### Zustand stores

`apps/itun/src/stores/` ([ADR-003](adrs/ADR-003-zustand-hydration.md)).
`entityStore` (pilots, mechs, crawlers, softLinks) reaches persistence through
`dbStoreFor(type)`. `list(type)` hydrates
lazily, then reads synchronously. `update()` validates, commits to Convex
(remote only), writes the backend store, then `set()`s, broadcasts
(`lib/db/broadcast`) so other tabs re-read, and emits the Change Log; a refused
write changes nothing. `entityStore.transfer()` moves value between entities in
one transaction. `activeContainerStore` is the current Game or Shelf. There is
no TanStack Query: reads are the hooks in `src/hooks/entities/` and
`convex/react`; do not add a query cache.

### Sharing

The one account-free share is the public sheet
([ADR-032](adrs/ADR-032-public-read-only-sheets.md)): `/p/:kind/:appId`, opt-in
through the `publicRead` column, read by `publicSheet.get`, toggled in
`ShareStatusDialog` → `PublicSheetPanel`. Snapshots are
retired ([ADR-036](adrs/ADR-036-retire-snapshot-shares.md)); the blobs stay
read-only in `su-itun-snapshots`. `GET /api/snapshots/:id`
(`src/lib/snapshot/handlers.ts`) answers only `{ kind, appId }`, and posted
`/s/:id` links still unfurl (`/og/s/:id.png`). The `/s/$id` loader
(`src/routes/s/$id.tsx`) calls `retrieveSnapshotIdentity`
(`src/lib/snapshot/client.ts`); `SnapshotLinkView` redirects to the public
sheet or shows a retired page. `snapshotIdentity`
(`src/lib/snapshot/identity.ts`) treats blob and answer as untrusted.

## Accounts and Games operations

Setup and diagnosis: the `convex-deploy-verify` skill. Repairs, rotations,
switching production on and error reporting:
[`convex-maintenance`](../.claude/skills/convex-maintenance/SKILL.md). Values
here are public; the OAuth client _secret_ lives only on the deployments.

|  | Dev | Production |
| --- | --- | --- |
| Deployment | `dev/alex-jarvis` (`perfect-donkey-72`) | `exuberant-porpoise-183` |
| Client URL (`VITE_CONVEX_URL`) | `https://perfect-donkey-72.convex.cloud` | `https://exuberant-porpoise-183.convex.cloud` |
| HTTP actions (`VITE_CONVEX_SITE_URL`) | `https://perfect-donkey-72.convex.site` | `https://exuberant-porpoise-183.convex.site` |
| `SITE_URL` (the **frontend** origin) | `http://localhost:5173` | `https://intheunionnow.com` |

Project `alex-jarvis:suref-itun`
([dashboard](https://dashboard.convex.dev/t/alex-jarvis/suref-itun)). The
production origin is `https://intheunionnow.com`, never a `workers.dev`
host. `apps/srd` has no accounts.

### Convex error reporting

Convex reports through the dashboard's Exception Reporting integration, not
code: queries and mutations have no network egress. It feeds Sentry project
`itun-convex` (org `susrd`, EU region). A quiet project is not evidence of a
healthy backend; enabling and re-verifying are in the `convex-maintenance`
skill. Client side, `src/lib/connection/serverError.ts` (`serverMessage`,
`isServerRefusal`) is the only way to tell a `ConvexError` refusal from a
redacted defect; never string-match `'Server Error'`.

### Discord

One application serves the bot and web sign-in; resetting the OAuth2 secret
leaves the bot token alone. One redirect URI per deployment
(`@convex-dev/auth` mounts `/api/auth/callback/` plus provider id `discord`):

```
https://perfect-donkey-72.convex.site/api/auth/callback/discord      (dev)
https://exuberant-porpoise-183.convex.site/api/auth/callback/discord (prod)
```

### Required deployment variables

**All three, or sign-in fails**, per deployment:

```bash
bunx convex env set AUTH_DISCORD_ID     <client-id>
bunx convex env set AUTH_DISCORD_SECRET <client-secret>
bunx convex env set SITE_URL            <frontend origin>
# add --prod to target production
```

`SITE_URL` is the one that bites. It is the **frontend** origin, _not_
`VITE_CONVEX_SITE_URL`, nothing prompts for it, and omitting it fails with an
opaque `Missing environment variable SITE_URL` 500 from the OAuth callback
rather than anything pointing at configuration.

**For the Discord bot**, one more on the Convex deployment and two on the bot's
Cloudflare Worker, set with `wrangler secret put`:

```bash
# Convex — enables the /bot/* route. UNSET disables the whole surface, so a
# deployment that has not opted in cannot be talked to by a bot at all.
bunx convex env set ITUN_BOT_SECRET <a long random string>

# The bot Worker (su-discord-bot) — both, or the bot stays in Solo mode.
ITUN_CONVEX_SITE_URL=https://<deployment>.convex.site
ITUN_BOT_SECRET=<the same value>
```

**For `/su invite`** ([ADR-039](adrs/ADR-039-targeted-invites.md)), one
more on the Convex deployment. It is the Discord application's **public** key —
the same value committed in `apps/discord-bot/wrangler.jsonc` — so it is not a
secret and may be passed as an argument:

```bash
bunx convex env set DISCORD_PUBLIC_KEY <the application's public key, hex>
```

Unset, `/su invite` answers "invites from Discord are not switched on" and
nothing else changes. Set to the wrong application's key, every `/su invite`
fails as unverified while every other command keeps working — check this
value first when only invites break.

`ITUN_CONVEX_SITE_URL` is the **HTTP-actions** origin (`.convex.site`), not the
client URL (`.convex.cloud`) and not the web origin. Getting it wrong presents
as every Game command reporting the deployment unreachable — which is honest but
points at the network rather than at the typo.

The secret is a **bearer credential**: whoever holds it can act as any Discord
user who has linked an account. That is bounded (it cannot invent a membership,
reach an unlinked account, read somebody's shelf, or see `encounterNpcs`) but it
is real. Store it in 1Password, never in git, and rotate on any suspicion.

### Verifying, secrets and denormalised columns

- **Probe:** `curl -s -D - -o /dev/null https://<deployment>.convex.site/api/auth/callback/discord`
  gives **302** to `SITE_URL` (correct), **500** `Missing environment variable`
  (`SITE_URL` unset) or **404** (auth routes not mounted; check `convex/http.ts`).
  The control `/api/auth/callback/bogusprovider` must be **500**.
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
- **Maintenance:** `convex/maintenance.ts` is operator-only (`bunx convex run`).
  The `convex-maintenance` skill holds each procedure: enabling error reporting,
  `dedupeAppIds`, `repairSoftLinks`, switching production on (no rollback by
  unsetting `VITE_CONVEX_URL`), rotating `JWT_PRIVATE_KEY` / `JWKS` (signs
  everyone out) and `AUTH_DISCORD_SECRET`. The workflow is
  [CI: production maintenance](#ci-production-maintenance).

## Rules and ITUN surfaces

Enforcement depends on the **mode** a surface is in
([ADR-021](adrs/ADR-021-itun-surface-taxonomy.md), governing;
[ADR-022](adrs/ADR-022-provenance-log-and-overrides.md)). The border is
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
| `sheet/CrawlerEconomyControl.tsx` (Upkeep / Upgrade / Trade) | Scrap-pool draw, Upgrade-Pool credit, the Deterioration d20, the Scrap swap | No crawler Dashboard; the economy hangs off the crawler hero (Core Book p.218-223) |
| `sheet/CrawlerSheet.tsx` bay Repair | 5 Scrap of crawler TL or higher; the bay flips Intact | Reached from the bay card; the draw is advisory |
| `sheet/MechItemCard.tsx` repair + remaining uses | Field-repair Scrap; `_used` counters | Acts on the card in front of you |

Nothing blocks (a disabled button plus a visible advisory); `scrapPool` stays
hand-editable; writes are tagged `LIVE_SHEET_TXN`, except row 3
(`MechSheet.tsx`'s `repairItem` still writes `LIVE_SHEET_MANUAL`). The list is
closed: a new transaction goes on the Dashboard. If the crawler gets a
Dashboard, row 1 moves there as `DASHBOARD_TXN`.

### Destructive consequences and provenance

A destructive, irreversible consequence in Guided Play splits per
[ADR-007](adrs/ADR-007-automation-boundary.md): the trigger fires, bookkeeping
applies, and destruction or a condition change waits for the player (Reactor
Overload, Critical Damage at 0 SP, meltdown). Free Edit sets the same states by
hand.

Every write goes to the per-entity, append-only Change Log, tagged
`transaction` / `override` / `manual`, emitted at `entityStore.update`
(`lib/db/changeLog.ts`, `lib/schemas/changeLog.ts`), read in `ChangeLogDrawer`
behind the sheet menu. Public sheets show no history; replay is unbuilt. The
overridden-stat marker shows on the Live Sheet only.

**Status:** the Wizard enforces hard (`PilotWizard.tsx`, `MechWizard.tsx`,
`CrawlerBuilder.tsx`; `Next` gated by `lib/rules/creation.ts`; exit via
`OffRulesEscape`). The Dashboard is built at `/dashboard/$id`
([architecture/dashboard.md](architecture/dashboard.md),
[ADR-015](adrs/ADR-015-dashboard-distinct-play-surface.md)). The Live Sheet is
Free Edit plus the list above, with cap overrides and revert. Place a feature
by mode, then rule class; resolve an ambiguous case here before building, and
update the matrix when a border moves.

## Combat loop

ITUN is a shared living sheet, not a game engine: play state moves through the
Zustand stores, with no combat RPCs, no turn enforcement and no undo (the
`changeLog` is provenance). Each player updates their own mech. Rules math is
pure and shared ([ADR-006](adrs/ADR-006-pure-rules-logic.md)); bookkeeping
auto-applies, destruction waits for the player
([ADR-007](adrs/ADR-007-automation-boundary.md)).

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

**Activation:** the Dashboard's `ActionsDeck.tsx` over `activationPatch()` in
`apps/itun/src/components/dashboard/dashboardRules.ts`; cost from `itemEconomy()`
(`sheet/mechItemRules.ts`) per action via `economyForActivation()`. Boarded,
the deck is the mech's chassis, systems and modules plus the pilot's abilities
and equipment; on foot, the pilot's alone. Each `PlayAction`'s `currency`
decides EP (adds Heat, can Push) or AP. One sequential write-through
([ADR-008](adrs/ADR-008-sequential-mutations.md)): deduct `currentEP`,
`clampHeat`, decrement `itemUses`, `storeState.update('mech', …)`. Cross-entity
moves use `entityStore.transfer()`.

**Destructive outcomes:** `autoApplyPatch()` strips a Meltdown's `destroyed`
and returns `meltdown: true` to confirm; Critical rolls and Eject are explicit
steps. An item marked Destroyed applies at once with an Undo toast
(`sheet/destroyedUndoToast.ts`).

**Heat:** `MechBand.tsx` and `ActionsDeck.tsx` call `heatCheckOncePatch()` /
`pushPatch()` and record `lastHeatCheck`. Auto: a pass, `20`, and `11–19`
(`shutdown` + `vulnerable`, SP damage equal to heat). Player-driven: `6–10` /
`2–5` set `requiresPlayerChoice` and the player marks the item's `StatusBadge`
([ADR-009](adrs/ADR-009-condition-model-destroyed-color.md)); `1` is confirmed.
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
Criticals (`MechBand.tsx`, `PilotBand.tsx`: `mechDamagePatch`,
`critDamagePatch`, `pilotDamagePatch`, `critInjuryPatch`), the reactor,
activation and `performCoreRoll`, Downtime (`DowntimeWizard.tsx`;
`mechBayStatus` / `medBayStatus` from `lib/rules/downtime.ts`), and salvage,
crafting and scrapping (`CrawlerBand.tsx`, `dashboardEconomy.ts` →
`lib/rules/salvage.ts`, `lib/rules/crafting.ts`, `lib/rules/scrapMech.ts`).
The Live Sheet has the crawler economy (`lib/rules/crawlerEconomy.ts`, mounted
by `SheetCrawler.tsx`) and
per-card `setItemUses`, `repairItem`, `cycleItemCondition`. Gone:
`HeatCheckControl`, `TakeDamageControl`, `PilotTakeDamageControl`,
`SalvageControl`, `CraftingControl`, `DowntimeControl`, `ScrapMechControl`,
`ConditionToggle`, `QuickRollFab`, any `apply_mech_damage` RPC, `entity_refs`
table or `useUpdateMech` hook.

## Display system

State rules, point at source; no prop tables. Session rules:
[`.claude/rules/display-system.md`](../.claude/rules/display-system.md); laws:
[ruleset](design-system/ruleset.md); [ADR-026](adrs/ADR-026-entity-card-design-rules.md).

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
`CardFootMeta` and `foldStatusControl`. Grids use `EntityGrid` /
`EntityGridRow`. Never hand-assemble a `label | value` readout: that is `Stat`
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
([ADR-010](adrs/ADR-010-srd-choices-ephemeral-vs-persisted.md)); ITUN wires it
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

## Component catalog (Ladle)

One catalog in `packages/component-lib`: `bun run ladle`, and
`bun --filter component-lib ladle:build` into `build-ladle/` (CI). It globs the
library's `src/`, `apps/itun/src/components/` and `apps/srd/src/components/`.
Story rules: [`packages/component-lib/CLAUDE.md`](../packages/component-lib/CLAUDE.md),
enforced by `src/story-coverage.test.ts`.

- `.ladle/config.mjs` runs in Node and the browser; `storyOrder` is
  re-evaluated without module scope, so it stays self-contained. It opens on
  `foundations--styleguide--overview`.
- `.ladle/components.tsx` wraps every story in the paper canvas and a `use()` +
  `Suspense` preload gate; without it stories render silently blank. Stories
  add no outer `bg-paper`.
- **Never add `@vitejs/plugin-react`** to `vite.config.ts`: a second React
  plugin blanks every story (`Missing field 'moduleType'`).
- `src/styles/ladle.css` imports the package stylesheet into `layer(su-base)`
  and points `@source` at all three roots. Only the `a11y` addon is on.
- **Size ladder** (`src/styles/sizing.ts`): Full, **Compact** (default), Mini;
  offer only real rungs, compose from `RUNG_TYPE` / `RUNG_INLINE_PADDING` as
  `Badge`'s `STAMP_SIZE` does.
- **Stories:** `Story` from `src/stories/_harness.tsx` (apps:
  `component-lib/stories/harness`); a static-literal default `title`; groups
  Foundations, Atoms, Containers, Compositions (sub-groups Entity, Catalog,
  Dashboard, Wizard, Shell; edit `SUBGROUPS` and `storyOrder` together). No
  args or controls; real SRD data; don't churn export names.

### Ladle shell relayout

`appendToHead` turns the nav (`.ladle-aside`) into a right-edge overlay toggled
by a button outside React, state as a class on `<html>`; desktop only. It
targets Ladle's internal classes (`.ladle-aside`, `.ladle-main`,
`.ladle-addons`): re-verify them on any upgrade.

### Ladle pin and type imports

`@ladle/react` is pinned to 5.1.1; its types drag Ladle's UI source under
`tsc`, which TypeScript 7 rejects, so nothing imports it (Biome's
`noRestrictedImports`). To bump: `ladle:build`, check no story is blank,
re-verify the relayout.

## Discord bot as a Game client

An authenticated client of ITUN Games ([ADR-030](adrs/ADR-030-accounts-games-server-of-record.md)):
`/su me`, `/su games`, `/su shelf`, `/su crew`, `/su sheet`,
`/su game bind|unbind|info`, `/su invite` ([ADR-039](adrs/ADR-039-targeted-invites.md))
and roll attribution on `/su roll`, on the `su-discord-bot` Worker. Conventions:
[`apps/discord-bot/CLAUDE.md`](../apps/discord-bot/CLAUDE.md); variables:
[above](#required-deployment-variables).

It calls `POST /bot/<op>` (`apps/itun/convex/botHttp.ts`); every `botClient`
function is internal. Write both credential halves in one pass (one
`openssl rand` piped to `convex env set` and `wrangler secret put`, never
printed): a mismatch fails as `unauthorized`. Verify without the secret:
`POST /bot/<op>` with none is **404** while unset, **401** once set; the
Worker's `GET /health` shows `configured.itun: true` and `mode: connected`
(presence only). Only a real Game command proves a match.

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
resolved by `model/bot.ts#userByDiscordId`; `users.discordId` is not read. Modes: Solo (variables unset; roll
and lookup only), Connected, Degraded (Convex down; reference commands work).
`/su roll` and `/su lookup` behave the same in every mode. `resolveActor`
returns `null` alike for no binding, account or membership; passive paths stay
silent, explicit ones reply ephemerally. Open: Mediator alerts to the channel
(`proposals.broadcast`, watermarked by the Change Log) and Apply / Decline
buttons. Gaps: `/su crew` maxima (`apps/discord-bot/src/gameEmbed.ts`) ignore
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
search index (`searchIndexJson.ts`). `ssg/pwa.ts` runs `workbox-build`'s
`generateSW` (`navigateFallback: null`, `skipWaiting`, `clientsClaim`,
navigations `NetworkFirst` with a 3 s timeout);
`src/runtime/chunkRecovery.client.ts` reloads once when chunks are gone.

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

**Accessibility:** Biome's `a11y` group (`biome.jsonc`). `tools/a11y-scan.ts`
(Playwright + axe-core: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`,
`wcag22aa`, `best-practice`) runs in CI over `tools/a11y-baseline.json`
and `tools/a11y-baseline-itun.json`, at desktop and `--device 'Pixel 7'`; a
stale entry fails until `--update-baseline`. Locally:
`bun tools/a11y-scan.ts http://localhost:4321 / /schema/chassis/ /about/`.
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

`pull_request` has **no `branches:` filter**: it matches the base branch, so
stacked PRs got no checks and could not merge. CodeQL likewise. `merge_group:`
stays dormant: it must be live on `main` before a merge queue is enabled.

### CI: concurrency

PR runs cancel superseded runs; **`main` never cancels** (group `github.sha`),
because the deploy fires on CI's `workflow_run` success.

### CI: reusing the PR's run

On a push to `main`, `changes` finds the merged PR (`GET
/repos/{owner}/{repo}/commits/{sha}/pulls`) and reuses its result only if
`HEAD^{tree}` equals the PR head's tree and every latest `CI Success` check-run
on that head succeeded; otherwise everything runs. It holds `checks: read`.
Every job declares `timeout-minutes` (15; 25 for browser builds); never drop
the key.

### CI: path filters

`shared` (reference package, observability, root config, test preloads,
workflows) affects every app; component-lib affects srd and itun. `CI Success`
passes a skipped job, so: `tools/check-workflows.ts` (`path-filters`) asserts
each app's `workspace:*` deps are in its group; root prose (`ABOUT_JRVS.md`,
`LLM_STATEMENT.md`, `SPECIAL_THANKS.md`) is `shared`, because #731 changed
only `SPECIAL_THANKS.md`, skipped `build-srd`, and turned the next three PRs
red; the axe script and
baselines are in their app's group. `code` is source, tools, `.github/` and
the Claude hooks and workflows; `docs` is `docs/**`, root `CLAUDE.md` /
`README.md` / `CONTRIBUTING.md`, `.claude/**`, `.mcp.json` (docs-only PRs skip
the suite and typecheck); `deps` is `bun.lock` and every `package.json`.

### CI: static-checks and coverage

One step, `bun tools/check.ts --profile=ci --areas=<code,docs>`: the registry
`bun run check` and pre-push read. Always: Biome and `styling`. `code`:
`generated`, typecheck, knip, `workflows`, `actionlint`
(`tools/lint-workflows.sh`: pinned, sha256-verified actionlint and zizmor,
`.github/zizmor.yml`, third-party actions SHA-pinned,
`persist-credentials: false`). `deps`: the audit. `code` or `docs`: `data`,
`doc-drift`, `observability`, `convex-codegen`, `convex-callers`. The test gate
is `coverage`: `bun run test:coverage` (`tools/run-coverage.ts`) fails a
workspace under its `FLOORS` total (bunfigs set
`coveragePathIgnorePatterns = ["../**"]`).

### CI: build jobs

All `needs: [changes]` only. `build-srd` builds once, runs `check:examples`,
srd's whole Playwright suite (add a spec to its run line, not a job) and the
axe scan on that `dist`; `mobile-chromium` (Pixel 7) runs smoke in both apps.
`build-itun` also bundles the Worker (`bun --filter itun worker:bundle`);
ITUN's full browser suite is nightly (`e2e-nightly.yml`). `build-discord-bot`
and `build-su-assets` bundle Workers; `build-ladle` builds stories. wrangler is
a devDependency of all four Worker apps; keep each `wrangler.jsonc`
`compatibility_date` at or below its bundled workerd.

### CI: PR title

The squash title is what release-please reads. `pr-title.yml` runs on
`opened`, `edited`, `reopened`, `synchronize`, with no `if:` or path filter (a
required context), because `ci.yml` does not run on `edited`. The squash body
is the PR body (`squash_merge_commit_message: PR_BODY`): a line starting with a conventional type or containing
`BREAKING CHANGE` changes the version bump.

### CI: aggregate gate

`quality-checks`, named `CI Success`, fails on `failure` or `cancelled`.
**Every job must be in its `needs:`** (`tools/check-workflows.ts`,
`aggregator`). `Analyze (javascript-typescript)` and `PR title is a
conventional commit` are separately required (`SEPARATELY_REQUIRED`), so
neither workflow is filtered. Change the trigger on `main` before the ruleset;
never poll another workflow.

### CI: repository settings

Owner-applied; no gate reads them.

- **`main` ruleset** (`gh api repos/SalvageUnion-io/SU-SRD/rulesets/<id>`):
  `active`, `~DEFAULT_BRANCH`, no `bypass_actors`; `deletion`,
  `non_fast_forward`, `required_linear_history`; `required_status_checks`
  (`strict_required_status_checks_policy: true`) with the three contexts each on `integration_id` 15368;
  `code_scanning` (`CodeQL`, `security_alerts_threshold: high_or_higher`,
  `alerts_threshold: errors`); no `merge_queue`.
- **Actions** (`gh api repos/SalvageUnion-io/SU-SRD/actions/permissions`):
  `allowed_actions: selected`, GitHub-owned plus `dorny/paths-filter@*`,
  `googleapis/release-please-action@*`, `oven-sh/setup-bun@*`, with
  `verified_allowed: false`; a PR adding a third-party action says so.
- Code scanning default setup `state: not-configured`; private vulnerability
  reporting `enabled: true` ([`SECURITY.md`](../SECURITY.md)).

### CI: deploy set

`CLOUDFLARE_API_TOKEN`, `CONVEX_DEPLOY_KEY`, `SENTRY_AUTH_TOKEN` and
`RELEASE_PLEASE_TOKEN` live only in the `production` Environment; each job
reading one declares it (`secrets-env`).

- **Shape:** `plan` → `build-srd` / `build-itun` → `push-convex` → `deploy-*`
  → `smoke` → `record`; `og-srd` renders OG images into srd's `dist` and only
  `deploy-srd` waits for it (render cache
  `apps/srd/node_modules/.cache/srd-og`). Deploys ship the builds' artifacts unrebuilt after
  **every** build is green; CI's builds are never shipped.
  `bun run check workflows` (`deploy-order`) asserts the edges and explicit
  status functions downstream of skippable jobs.
- **`push-convex`** asserts the deploy key's URL equals `ITUN_CONVEX_URL`
  before pushing; the backend leads the client by minutes.
- **The base is the last deploy:** `record` moves the tag
  `deployed/cloudflare`; the next run diffs against it. No record, a shared
  path or `force_all` deploys everything; the shared set includes the root
  prose files and excludes `test/` and every `.github/` file but this workflow
  and `.github/actions/`. A version-only `packages/*/package.json` change ships
  nothing. The decision is
  `tools/deploy-surfaces.ts` (`tools/__tests__/deploy-surfaces.test.ts`). When
  HEAD is an ancestor of the record the run is `stale`; only a dispatch
  (`--allow-backwards`) rolls back.
- A failed `deploy-*` skips `smoke` and `record`, so the next run redeploys.
  `record` holds `contents: write` through a REST call, in its own job. A
  dispatched `sha` reaches scripts through `env:`. The smoke list is
  `tools/smoke-production.sh`, also run daily by `e2e-nightly.yml`
  (`production-smoke`).

### CI: production maintenance

`convex-maintenance.yml` (`workflow_dispatch`, `main` only,
`environment: production`) runs one allowlisted, idempotent function from
`apps/itun/convex/maintenance.ts` (today `repairContainers`) with `--prod`,
refusing a key that is not `prod:` or `project:`. A new function goes in both
the `choice` input and the step's `case`.

## Dependencies

### Dependency updates

Dependabot updates GitHub Actions only ([`.github/dependabot.yml`](../.github/dependabot.yml)):
one grouped Monday PR for `.github/workflows/` and `.github/actions/setup-bun`,
7-day cooldown, merged by hand. **Bun dependencies are
updated by hand:** `bun outdated --filter='*'`, then `bun update --latest <pkg>`
or `bun add <pkg>@<version>` in every manifest naming it. `.bun-version`, the
root `packageManager` and `bun-types` move together (`workflows`,
`bun-version`); `.mcp.json`'s `convex@` pin moves with
`apps/itun/package.json`'s (`tools/__tests__/mcp-config.test.ts`).

### Install cooldown

`bunfig.toml` refuses versions **under 3 days old**: an exact pin errors
(`blocked by minimum-release-age`), a **caret range silently resolves down**.
`bun install --frozen-lockfile` is unaffected. The escape hatch is
`minimumReleaseAgeExcludes` (`bun-types`), never a lower number.

### Dependency audit

`bun audit --audit-level=high` (the `audit` check) gates PRs that change
`bun.lock` or a `package.json`. One suppression: `braces` GHSA-vfj7-8cjw-p6xm,
no fixed release, reachable only via component-lib's devDependency
`@ladle/react` → `globby` → `fast-glob` → `micromatch`; its `--ignore` in
`tools/check.ts` says what removes it. A new `--ignore` records the same.
`audit-watch.yml` audits every severity weekly without it, keeping one issue
open; its watch list is `nanoid`, `fast-uri`, `brace-expansion`, `filelist`.
Fix a transitive advisory by dedupe, then `bun update <pkg>`, then a floor.
`bun why <pkg>` prints the path.

### The overrides block

| Entry | Why |
| --- | --- |
| `fast-uri: >=3.1.6 <4` | ReDoS class; `ajv` asks `^3.0.1` |
| `filelist: >=1.0.6` | `jake` asks `^1.0.4` |
| `nanoid: >=3.3.18` | `GHSA-2v37-7h3g-55p8`; `postcss` asks `^3.3.17` |
| `sharp: >=0.35.5` | `GHSA-wq5f-xc86-pv6w`; `miniflare` pins 0.35.4. Delete once `bun why sharp` shows ≥0.35.5 |

Floors, never exact versions. `brace-expansion` cannot be floored (two
majors). Delete an override `bun why` no longer needs; re-derive by emptying
the block, `bun install`, `bun run check audit`.

### Declare what you import

Each workspace declares every package its shipping code imports as a
`dependency` in its own manifest, never a devDependency or trusted peer;
component-lib's `react` / `react-dom` are the exception. If deleting a
devDependency breaks `bun run build` or a deploy, it was never one.

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
`apps/itun/package.json`. It needs `CONVEX_DEPLOYMENT` in `apps/itun/.env.local`
(from `bunx convex dev`; `.worktreeinclude` copies it into Claude Code
worktrees), else every call fails `No CONVEX_DEPLOYMENT set`. `context7`
returns condensed docs: verify load-bearing APIs against `node_modules`.

### Cloud sessions

`gh` is absent: use the session's `mcp__github__*` tools, loaded with
ToolSearch first (`select:mcp__github__create_pull_request,…`). The remote MCP
hosts (`bindings.mcp.cloudflare.com`, `observability.mcp.cloudflare.com`,
`mcp.sentry.dev`, `mcp.context7.com`) fail (`ERR_PROXY_TUNNEL`, 403) unless
the environment allows them; report those signals **unread**. `convex` has no
credentials: ask for data. If `bun --version` differs from `.bun-version`, run
with `PATH="$HOME/.local/share/su-srd-bun/$(cat .bun-version):$PATH"` (the
SessionStart hook installs it under `~/.local/share/su-srd-bun/<version>/`) and `bun install --frozen-lockfile`. Never fake
a GitHub step that has no route.

### Cloudflare

Everything runs here ([ADR-033](adrs/ADR-033-cloudflare-hosting.md)), account
`alxjrvs@gmail.com`, shared with RANDSUM (accepted risk, ADR-033 §6).

| Worker | Serves | Bindings |
| --- | --- | --- |
| `su-srd` | `salvageunion.io`, `www.` | none (Static Assets) |
| `su-itun` | `intheunionnow.com`, `www.`, `/api/snapshots/:id`, old unfurls | `ASSETS`, R2 `SNAPSHOTS`, `OG_METRICS` |
| `su-assets` | `assets.salvageunion.io` | R2 `LP_ASSETS`, `IMAGES` |
| `su-discord-bot` | Discord interactions, 5-minute cron | secrets only |

R2: `su-itun-snapshots` (read-only, never delete from it) and `su-lp-assets`.
Zones `salvageunion.io` and `intheunionnow.com`. Previews under
`alxjrvs.workers.dev`. Re-derive with `wrangler deployments list`,
`wrangler r2 bucket list` and the `apps/*/wrangler.jsonc` files. **Outside the
repo:** the `www` → apex Redirect Rule and per-zone Images Transformations.

### Sentry

Org **`susrd`**, **EU region** (`https://de.sentry.io`,
<https://susrd.sentry.io>); a DSN from another region silently fails.
Projects: `srd` (`VITE_SENTRY_DSN`, repo variable `SRD_SENTRY_DSN`\*), `itun`
(`VITE_SENTRY_DSN`), `itun-functions` (itun Worker, `SENTRY_DSN`),
`itun-convex` ([dashboard toggle](#convex-error-reporting)), `su-assets` and
`su-discord` (`SENTRY_DSN`).

\* The DSN may still sit in `PUBLIC_SENTRY_DSN` (`deploy-cloudflare.yml` reads
`vars.SRD_SENTRY_DSN || vars.PUBLIC_SENTRY_DSN`): create `SRD_SENTRY_DSN`,
delete the old variable, then drop both fallbacks.

No DSN tree-shakes the SDK out, and a `connect-src` missing the ingest origin
blocks every event, so `tools/check-observability.ts`
(`bun run check observability`) checks DSN gating and CSP together and pins `https://*.ingest.de.sentry.io`. CSP sources:
`apps/srd/public/_headers` and `apps/itun/src/worker/securityHeaders.ts`;
change CSP or region in lockstep. Sourcemaps upload only from
`deploy-cloudflare.yml`, through `sentrySourcemaps()` in `observability/vite`
(gated on `SENTRY_AUTH_TOKEN`; one org token and `vars.SENTRY_ORG`; project
`vars.SENTRY_PROJECT` for itun, literal `srd` for srd).

### Convex, GitHub and retired hosts

- **Convex:** project `alex-jarvis:suref-itun`; deployments in
  [Accounts and Games operations](#accounts-and-games-operations).
  `.convex.site` is HTTP actions, `.convex.cloud` the client; swapped, they
  read as "unreachable". Modules: [`apps/itun/convex/`](../apps/itun/convex/).
- **GitHub:** [`SalvageUnion-io/SU-SRD`](https://github.com/SalvageUnion-io/SU-SRD),
  `main`; releases are release-please
  ([ADR-024](adrs/ADR-024-derived-release-changelogs.md)).
- **Netlify (retired, deletion pending, ADR-033 P8):** team `salvageunion-io`
  (`6a3b41d74a67a34e3aae3ede`); delete by id: `suindex` (`apps/srd`,
  `62482841-12dd-4e35-a4ed-900f357675dc`), `in-the-union-now`
  (`801d6f8d-1ad4-42c1-a29d-126b2d69ee69`), `su-assets`
  (`19faf088-1c54-4bae-9312-74d7b0a94cea`). Render is gone.

Re-derive: `claude mcp list`; Sentry MCP `find_organizations` /
`find_projects`; `bunx convex mcp start` → `status`;
`bun run check:observability:live`.
