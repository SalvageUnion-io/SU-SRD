# itun (ITUN) — Character Builder & Game Manager

React app for building and running Salvage Union pilots, mechs, and crawlers.

**Storage modes — read before touching data.** This file owns them;
[ADR-030](../../docs/ARCHITECTURE.md#adr-030),
[ADR-034](../../docs/ARCHITECTURE.md#adr-034) and
[ADR-035](../../docs/ARCHITECTURE.md#adr-035) record why.

| Mode | When | Source of truth |
| --- | --- | --- |
| **Solo** | not signed in — in **every** build, CI and `bun run dev` included | nothing: the in-memory backend; writes do not survive a reload; no Dashboard |
| **Connected** | signed in, online | Convex; IndexedDB is a cache |
| **Disconnected** | signed in, offline | read-only — not a write queue |

- Resolve the mode through `src/lib/connection/` — never `navigator.onLine` or
  an auth flag.
- **Never introduce a store, field or flow that persists only on a device.**
- **There is no durable anonymous backend.** `selectBackend()` is
  `memory | remote | blocked`; the old `local` backend and its
  `VITE_REQUIRE_ACCOUNT` flag are retired. A unit test that needs durability
  calls `withSignedInBackend()` (`src/stores/__tests__/signedInBackend.ts`); an
  e2e spec signs in through `e2e/fixtures.ts`.
- **One local → account reconciler.** `AccountReconciler` (root-mounted, over
  `src/lib/account/reconcile.ts`) owns the upload of this tab's anonymous work
  on sign-in, the migration of a pre-account roster still in IndexedDB
  (reconciled against `entities.listMine`), and mounts `ShelfSync`; signed out
  it renders nothing. Do not add a second surface that uploads local work; there
  is no legacy exemption, no claim card, and no offer-and-decline path.
- **A container written twice must be written together** — the row's `gameId`
  column and the body's `gameId` (`shelveBody` in `convex/claim.ts`;
  `maintenance.repairContainers` repairs old rows toward the column).
- **e2e durability specs need an account.** Without `VITE_CONVEX_URL` +
  `VITE_TEST_AUTH` in the build and `ITUN_TEST_AUTH` on the deployment they
  SKIP; the nightly `e2e-itun` job provisions a throwaway Convex backend and
  runs them for real. See `e2e/fixtures.ts`.

**One account-free way to share: the public sheet
([ADR-032](../../docs/ARCHITECTURE.md#adr-032)).** A **live**
read-only page at `/p/:kind/:appId`, opt-in per entity via the `publicRead`
Convex column, served by one deliberately unauthenticated query
(`convex/publicSheet.ts`). Off by default; turning it off revokes everywhere at
once, because the URL is derived rather than minted.

**Snapshots are retired**
([ADR-036](../../docs/ARCHITECTURE.md#adr-036)): nothing mints or
revokes them, and an old `/s/:id` redirects to the public sheet if its entity is
public, else shows a "retired" page. The R2 bucket is read-only — never delete
from it.

Every read-only sheet — a crewmate's at `/sheet/:kind/:id`, the public one —
is the live `<Sheet readOnly>` over `readOnlySheetStore.ts`. Don't add another.

## Stack

- React 19 + Vite, TypeScript.
- **TanStack Router** — file-based routes in `src/routes/`; the route tree is
  generated to `src/routeTree.gen.ts` (do not hand-edit).
- **No TanStack Query** — entity read hooks are store selectors in
  `src/hooks/entities/`; see `.claude/rules/itun-data-access.md`.
- **Zustand** stores for persistent client state (`src/stores/`).
- **Base UI** primitives from `component-lib` (`ui/`, `chrome/`, `base/`) —
  there is no app-local `src/components/ui/`. Styling is the `component-lib`
  theme; Tailwind is being removed
  ([plan](../../docs/design-system/tailwind-removal.md)).
- **PWA** (`vite-plugin-pwa`, **`registerType: 'prompt'`**) — installable,
  offline-capable. It is `prompt` and must stay that way: `autoUpdate` force-sets
  `skipWaiting` + `clientsClaim` (an assignment in the plugin, not a default, so
  the `workbox` block cannot override it), which activated a new worker under a
  live page and dropped the precache entries it was still resolving chunks
  against. Navigations are **network-first** (`src/lib/sw/workbox.ts`): online
  boots the deployed shell, offline the precached one. See the headers of
  `vite.config.ts`, `src/lib/sw/`, `src/lib/chunkRecovery.ts` and the Worker's
  `/assets/*` → 404 rule (`src/worker/index.ts`).

## Persistence (read before touching data)

- Player data lives in **IndexedDB** via `idb` (`src/lib/db/`). Stores
  (`src/lib/db/stores.ts`): `pilots`, `mechs`, `crawlers`, `workspaces`
  (retired; kept so migrations v10/v13 run),
  `softLinks`, `mechPatterns`, `encounterNpcs`, and the append-only
  `changeLog` provenance store ([ADR-022](../../docs/ARCHITECTURE.md#adr-022)) —
  the last is keyed by an autoIncrement `seq`, not `id`, and has no CRUD
  surface (`src/lib/db/changeLog.ts` exposes append/list only).
- **Zod schemas (`src/lib/schemas/`) are the source of truth** for entity shape;
  the DB layer parses on read/write ([ADR-002](../../docs/ARCHITECTURE.md#adr-002)).
- Reads are salvage-tolerant (lenient re-parse + warning on version skew); rows
  heal on next write. See `src/lib/db/crud.ts`.
- Schema/version changes go through `src/lib/db/migrations/` (see its README).
- Records store **slug references** into `salvageunion-reference` (e.g.
  `classRef: 'salvager'` on a pilot, `chassisRef` on a mech), never copies of
  game data; resolve them against `SalvageUnionReference` at render time.

## State flow (`src/stores/`)

- `entityStore` (pilots/mechs/crawlers/softLinks), plus `activeContainerStore`,
  `cockpitPrefsStore`, `patternStore`, `encounterStore`, and
  `playStateStore` (Dashboard Downtime and Dial).
- **Workspaces are retired.** An entity lives in exactly one **container** — a
  shared **Game** or the owner's **Shelf** ("My Stuff") — encoded as one
  nullable `gameId` and resolved through `src/lib/container.ts`, never by
  reading `workspaceId` (a pre-ADR-030 fallback). Filter with `containerOf` +
  `sameContainer`, and only when `mode === 'connected'`: an anonymous user has
  no Games, so their surfaces render the whole pile unfiltered. `/` (`Roster`)
  shows one container at a time; there are no Games pages.
- **Assignments** ([ADR-037](../../docs/ARCHITECTURE.md#adr-037)):
  draw soft links only via `assignLink`; the rules are
  `src/lib/links/linkRules.ts`, shared with `convex/`.
- **Lazy auto-hydration:** first `list(type)` loads from the current backend
  (the IndexedDB cache signed in, the in-memory store anonymous); later reads
  are synchronous.
- **Write-through:** `update`/`create`/`delete` commit to Convex first when
  signed in, then the backend, then in-memory state; cross-tab writes
  invalidate via broadcast (never for the anonymous backend)
  ([ADR-003](../../docs/ARCHITECTURE.md#adr-003)).
- Route persistent entity state through the store, **never** through a
  separate query cache (see `.claude/rules/itun-data-access.md`).

## Combat / rules

- Pure math lives in `salvageunion-reference` — `lib/rules/` (heat check, take
  damage, core mechanic, derived maxima, …); import it from the
  `salvageunion-reference/rules` subpath export, never the main barrel and
  never through a local re-export. `src/lib/rules/` holds only ITUN's
  app-local rules: e.g. `heatCheck.ts` adds `heatCheckPatch` (effect →
  `Partial<Mech>`). Every real die roll is the package's `rollDie(sides)`.
- **Play actions live on the Dashboard, not the Live Sheet.** Activation and
  heat check are assembled as patches in
  `src/components/dashboard/dashboardRules.ts` (`activationPatch`,
  `heatCheckOncePatch`, `pushPatch`, `mechDamagePatch`, …) and applied by
  `ActionsDeck.tsx` and the Active Item bands (`MechBand.tsx`,
  `PilotBand.tsx`, `CrawlerBand.tsx`) as one write-through
  ([ADR-008](../../docs/ARCHITECTURE.md#adr-008),
  [ADR-021](../../docs/ARCHITECTURE.md#adr-021)).
- Non-destructive heat-check outcomes auto-apply; destructive condition changes
  stay player-driven via the card status badge (`StatusBadge` from
  `component-lib`, wired through `MechItemCard.tsx` → `cycleItemCondition` in
  `src/components/sheet/MechSheet.tsx`)
  ([ADR-007](../../docs/ARCHITECTURE.md#adr-007),
  [ADR-009](../../docs/ARCHITECTURE.md#adr-009)).
- The one sheet-local play control is `CrawlerEconomyControl.tsx`.
- Full picture: [combat loop](../../docs/ARCHITECTURE.md#combat-loop).

## Conventions

- Reuse `component-lib` components before building new UI; choices stay
  persistence-agnostic in the shared library — ITUN owns the selections
  ([ADR-010](../../docs/ARCHITECTURE.md#adr-010)).
- **Do not add a Sentry SDK to `convex/`.** The browser bundle
  (`src/lib/observability.ts`) and the Worker (`src/worker/index.ts`, via
  `observability/cloudflare`) each own one; Convex uses its first-party
  Exception Reporting integration (a dashboard toggle, no code — queries and
  mutations have no `fetch`). **A quiet Sentry project is not evidence of a
  healthy backend:** re-verify by forcing an error and comparing against
  `bunx convex logs --deployment alex-jarvis:suref-itun:prod`. Runbook:
  [convex-maintenance](../../.claude/skills/convex-maintenance/SKILL.md).
- **Throw `ConvexError` when the message is for a player; plain `Error` when it
  is not.** Convex redacts every non-`ConvexError` throw to
  `"[CONVEX M(fn)] […] Server Error"` before the client sees it, so a
  user-facing message thrown as a plain `Error` is written and then discarded.
  `NotAuthorized` (`convex/model/permissions.ts`) extends `ConvexError` for
  exactly this reason; parse failures and broken invariants stay plain. On the
  client, read it with `serverMessage()` / `isServerRefusal()` from
  `src/lib/connection/serverError.ts` — never by string-matching `'Server Error'`,
  and never by rendering `String(err)` from a mutation.
- **Build every Convex mutation with `mutation` / `internalMutation` from
  `convex/model/entities.ts`, never from `_generated/server`.** Those wrap the
  generated builders with the triggers that keep `games.summary` (a Game's
  counts) current; a mutation built without them writes rows the summary
  never hears about. Biome enforces it inside `convex/`. Every public
  query/mutation also needs a caller in `src/` —
  `tools/check-convex-callers.ts` fails on one nobody calls.
- **Render crashes reach Sentry through `createRoot`'s error hooks**
  (`reactRootErrorHandlers` in `src/lib/observability.ts`), because an error a
  boundary catches never reaches `window.onerror`. Every route has a boundary —
  the router's `defaultErrorComponent`, with the root's full-page one as the
  last resort (`src/components/shared/RouteErrors.tsx`) — so do not report from
  an `errorComponent` as well, or each crash is sent twice.
- **A caught error is either reported or explained — never just dropped.**
  Catching is what keeps an error away from Sentry's global handlers, so a
  `catch` must do one of three things: produce an outcome the user or caller
  sees (an error state, a 4xx/5xx, a rethrow with `cause`), report through
  `captureException` (browser) or `reportError` / `reportSnapshotError`
  (Worker), or carry a comment saying why dropping it is correct. Biome's
  `noEmptyBlockStatements` rejects a block with none of those. Reading
  reference data that may not be preloaded goes through
  `readReference` (`src/lib/readReference.ts`), which
  stays silent for `SchemaNotLoadedError` and reports anything else once per
  source — never a bare `try { SalvageUnionReference… } catch { return [] }`.
- **Never insert into an `appId`-addressed table without checking first.**
  `pilots`, `mechs` and `crawlers` are looked up by the client's `appId`, and
  `by_app_id` is an ordinary index — **not** a uniqueness constraint — so
  nothing in the database stops a second row. Prevention is the rule:
  `appIdTaken` before any insert. `convex/maintenance.ts` repairs rows already
  in that state (`dedupeAppIds`, dry-run by default).

  The lookups (`byAppId` / `crawlerByAppId`) do **not** throw on a duplicate:
  they resolve to the oldest row (the one `dedupeAppIds` keeps) and
  `console.warn`, because a throw in a fire-and-forget mirrored write silently
  stops the write reaching the server.
- **A copy gets a new UUID; a move keeps its own.** These pull in opposite
  directions, so both matter:
  - **Copy → new id.** Importing a bundle (`mergeImport`) and seeding the
    Starter Set (`seedStarterSet`) each mint a fresh UUID per row and remap the
    soft links onto them. An entity id becomes its `appId` on the server, so a
    copy that kept its id would put one id in two accounts — and since a
    duplicate now resolves to the oldest row, the second account's mirrored
    writes aim at the first account's entity and are refused by `assertMayWrite`
    as somebody else's. Never write a fixed or template id into
    `pilots`/`mechs`/`crawlers`; record provenance in `seedRef`, which is what
    it is for.
  - **Move → same id.** Shelf ↔ Game is a container change, patching `gameId`
    and nothing else. A Game is a viewport onto the same sheet, not a duplicate
    of it — never re-mint on a move, and never treat one as a fork.

## Commands

```bash
bun run dev:itun          # build package + start ITUN dev server
bun --filter itun test
bun run e2e:itun          # Playwright e2e (chromium)
bun --filter itun typecheck
```

Deploys to Cloudflare Workers (SPA + the `/s/:id` lookup in one Worker); config in
`wrangler.jsonc`, deployed from `.github/workflows/deploy-cloudflare.yml`.
