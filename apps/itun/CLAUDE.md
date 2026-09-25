# itun (ITUN) — Character Builder & Game Manager

React app for building and running Salvage Union pilots, mechs, and crawlers.

**Storage modes — read before touching data.** This file owns them;
[ADR-030](../../docs/adrs/ADR-030-accounts-games-server-of-record.md),
[ADR-034](../../docs/adrs/ADR-034-account-required-persistence.md) and
[ADR-035](../../docs/adrs/ADR-035-no-isolated-local-only-data.md) record why.

| Mode | When | Source of truth |
| --- | --- | --- |
| **Solo** | not signed in — in **every** build, CI and `bun run dev` included | nothing: the in-memory backend; writes do not survive a reload |
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
  `src/lib/account/reconcile.ts`) owns the signed-out banner and download, the
  upload of this tab's anonymous work on sign-in, the migration of a pre-account
  roster still in IndexedDB (reconciled against `entities.listMine`), and mounts
  `ShelfSync`. Do not add a second surface that uploads local work; there is no
  legacy exemption, no claim card, and no offer-and-decline path.
- **A container written twice must be written together** — the row's `gameId`
  column and the body's `gameId` (`shelveBody` in `convex/claim.ts`;
  `claim.repairContainers` repairs old rows toward the column).
- **e2e durability specs need an account.** Without `VITE_CONVEX_URL` +
  `VITE_TEST_AUTH` in the build and `ITUN_TEST_AUTH` on the deployment they
  SKIP; the nightly `e2e-itun` job provisions a throwaway Convex backend and
  runs them for real. See `e2e/fixtures.ts`.

**Two account-free ways to share, and they are not interchangeable
([ADR-032](../../docs/adrs/ADR-032-public-read-only-sheets.md)):**

- **Snapshot** ([ADR-004](../../docs/adrs/ADR-004-snapshot-netlify-functions.md))
  — a **frozen** copy, minted per share, stored as an opaque R2 object. Its
  id is the whole capability, including for revocation. Unchanged.
- **Public sheet** — a **live** read-only page at `/p/:kind/:appId`, opt-in per
  entity via the `publicRead` Convex column, addressed by app id, and served by
  one deliberately unauthenticated query (`convex/publicSheet.ts`). Off by
  default; turning it off revokes everywhere at once, because the URL is derived
  rather than minted.

Both render through `frozenSheet.ts`, which the Game crew view also uses — three
consumers, one renderer. Don't add a fourth read-only sheet renderer.

## Stack

- React 19 + Vite, TypeScript.
- **TanStack Router** — file-based routes in `src/routes/`; the route tree is
  generated to `src/routeTree.gen.ts` (do not hand-edit).
- **No TanStack Query.** It was mounted and never called, so it was removed;
  the typed entity read hooks live in `src/hooks/entities/` (selectors over
  the Zustand stores). See `.claude/rules/itun-data-access.md`.
- **Zustand** stores for persistent client state (`src/stores/`).
- **Base UI** primitives from `component-lib` (`ui/`, `chrome/`, `base/`) —
  there is no app-local `src/components/ui/`. Styling is the `component-lib`
  theme; Tailwind is being removed
  ([plan](../../docs/design-system/tailwind-removal.md)).
- **PWA** (`vite-plugin-pwa`, **`registerType: 'prompt'`**) — installable,
  offline-capable. It is `prompt` and must stay that way: `autoUpdate` force-sets
  `skipWaiting` + `clientsClaim` (an assignment in the plugin, not a default, so
  the `workbox` block cannot override it), which activated a new worker under a
  live page and ran `cleanupOutdatedCaches()` — deleting the precache that page
  was still resolving code-split chunks against. See the header comments in
  `vite.config.ts`, `src/lib/sw/register.ts` and `src/lib/chunkRecovery.ts`,
  plus the Worker's `/assets/*` → 404 rule (`src/worker/index.ts`) that stops a
  rotated-away chunk coming back as `200 text/html`.

## Persistence (read before touching data)

- Player data lives in **IndexedDB** via `idb` (`src/lib/db/`). Stores
  (`src/lib/db/stores.ts`): `pilots`, `mechs`, `crawlers`, `workspaces` (a
  retired container — see below; the object store survives only so migrations
  v10/v13 still run on old databases),
  `softLinks`, `mechPatterns`, `encounterNpcs`, and the append-only
  `changeLog` provenance store ([ADR-022](../../docs/adrs/ADR-022-provenance-log-and-overrides.md)) —
  the last is keyed by an autoIncrement `seq`, not `id`, and has no CRUD
  surface (`src/lib/db/changeLog.ts` exposes append/list only).
- **Zod schemas (`src/lib/schemas/`) are the source of truth** for entity shape;
  the DB layer parses on read/write ([ADR-002](../../docs/adrs/ADR-002-indexeddb-idb-zod.md)).
- Reads are salvage-tolerant (lenient re-parse + warning on version skew); rows
  heal on next write. See `src/lib/db/crud.ts`.
- Schema/version changes go through `src/lib/db/migrations/` (see its README).
- Records store **slug references** into `salvageunion-reference` (e.g.
  `classRef: 'salvager'` on a pilot, `chassisRef` on a mech), never copies of
  game data; resolve them against `SalvageUnionReference` at render time.

## State flow (`src/stores/`)

- `entityStore` (pilots/mechs/crawlers/softLinks), plus `activeContainerStore`,
  `cockpitPrefsStore`, `patternStore`, `encounterStore`, and the ephemeral
  `playStateStore` (Dashboard mount state).
- **Workspaces are retired.** An entity lives in exactly one **container** — a
  shared **Game** or the owner's personal **Shelf** — encoded as one nullable
  `gameId` and resolved through `src/lib/container.ts`, never by reading
  `workspaceId` (deprecated, kept only as a pre-ADR-030 fallback). Filter with
  `containerOf` + `sameContainer`, and only when `mode === 'connected'`: an
  anonymous user has no Games, so their surfaces render the whole pile unfiltered.
- **Lazy auto-hydration:** first `list(type)` loads from the current backend
  (the IndexedDB cache signed in, the in-memory store anonymous); later reads
  are synchronous.
- **Write-through:** `update`/`create`/`delete` commit to Convex first when
  signed in, then the backend, then in-memory state; cross-tab writes
  invalidate via broadcast (never for the anonymous backend)
  ([ADR-003](../../docs/adrs/ADR-003-zustand-hydration.md)).
- Route persistent entity state through the store, **never** through a
  separate query cache (see `.claude/rules/itun-data-access.md`).

## Combat / rules

- Pure math lives in `salvageunion-reference` — `lib/rules/` (heat check, take
  damage, core mechanic, …), imported via the `salvageunion-reference/rules`
  subpath export, never the main barrel. `src/lib/rules/` is
  ITUN's re-export + app-local layer: `heatCheck.ts` re-exports the package's
  `performHeatCheck` / `performPush` / `clampHeat` and adds `defaultRoll` (the
  `@randsum/roller` binding) and `heatCheckPatch` (effect → `Partial<Mech>`);
  `derivedStats.ts` computes the derived maxima.
- **Play actions live on the Dashboard, not the Live Sheet.** Activation and
  heat check are assembled as patches in
  `src/components/dashboard/dashboardRules.ts` (`activationPatch`,
  `heatCheckOncePatch`, `pushPatch`, `mechDamagePatch`, …) and applied by
  `ActionsDeck.tsx` and the Active Item bands (`MechBand.tsx`,
  `PilotBand.tsx`, `CrawlerBand.tsx`) as one write-through
  ([ADR-008](../../docs/adrs/ADR-008-sequential-mutations.md),
  [ADR-021](../../docs/adrs/ADR-021-itun-surface-taxonomy.md)).
- Non-destructive heat-check outcomes auto-apply; destructive condition changes
  stay player-driven via the card status badge (`StatusBadge` from
  `component-lib`, wired through `MechItemCard.tsx` → `cycleItemCondition` in
  `src/components/sheet/MechSheet.tsx`)
  ([ADR-007](../../docs/adrs/ADR-007-automation-boundary.md),
  [ADR-009](../../docs/adrs/ADR-009-condition-model-destroyed-color.md)).
- The sheet-side play-control panels were removed in the poster redesign; play
  actions stay on the Dashboard. The one sheet-local control is
  `CrawlerEconomyControl.tsx`.
- Full picture: [docs/architecture/combat-loop.md](../../docs/architecture/combat-loop.md).

## Conventions

- Reuse `component-lib` components before building new UI; choices stay
  persistence-agnostic in the shared library — ITUN owns the selections
  ([ADR-010](../../docs/adrs/ADR-010-srd-choices-ephemeral-vs-persisted.md)).
- Backup nudge (`src/lib/backupNudge.ts`) tracks un-exported writes.
- **Do not add a Sentry SDK to `convex/`.** The browser bundle
  (`src/lib/observability.ts`) and the Worker (`src/worker/index.ts`, via
  `observability/cloudflare`) each own one; Convex uses its first-party
  Exception Reporting integration (a dashboard toggle, no code — queries and
  mutations have no `fetch`). **A quiet Sentry project is not evidence of a
  healthy backend:** re-verify by forcing an error and comparing against
  `bunx convex logs --deployment alex-jarvis:suref-itun:prod`. Runbook in
  [accounts-and-games.md](../../docs/architecture/accounts-and-games.md)
  ("Convex error reporting — a dashboard toggle, not code").
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
  generated builders with the triggers that keep `games.summary` (the Games
  list's counts) current; a mutation built without them writes rows the summary
  never hears about. Biome enforces it inside `convex/`. Every public
  query/mutation also needs a caller in `src/` —
  `tools/check-convex-callers.ts` fails on one nobody calls.
- **Render crashes reach Sentry through `createRoot`'s error hooks**
  (`reactRootErrorHandlers` in `src/lib/observability.ts`), because an error a
  boundary catches never reaches `window.onerror`. Every route has a boundary —
  the router's `defaultErrorComponent`, with the root's full-page one as the
  last resort (`src/components/shared/RouteErrors.tsx`) — so do not report from
  an `errorComponent` as well, or each crash is sent twice.
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

Deploys to Cloudflare Workers (SPA + the snapshot API in one Worker); config in
`wrangler.jsonc`, deployed from `.github/workflows/deploy-cloudflare.yml`.
