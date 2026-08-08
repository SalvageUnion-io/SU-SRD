# itun (ITUN) — Character Builder & Game Manager

React app for building and running Salvage Union pilots, mechs, and crawlers.

**Two storage modes matter when you touch data**
([ADR-030](../../docs/adrs/ADR-030-accounts-games-server-of-record.md), which
supersedes ADR-001):

- **Solo** — not signed in. IndexedDB is the source of truth and nothing is
  gated. This is still the default and must keep working forever; a build with
  no `VITE_CONVEX_URL` (CI, a fresh checkout) is permanently Solo.
- **Connected / Disconnected** — signed in. Convex is the source of truth and
  IndexedDB becomes a cache. Offline means **read-only**, not a write queue.

Resolve the mode through `src/lib/connection/` — never by reading
`navigator.onLine` or an auth flag directly. Snapshot sharing
([ADR-004](../../docs/adrs/ADR-004-snapshot-netlify-functions.md)) is unchanged
and remains the account-free way to share a build.

## Stack

- React 19 + Vite, TypeScript.
- **TanStack Router** — file-based routes in `src/routes/`; the route tree is
  generated to `src/routeTree.gen.ts` (do not hand-edit).
- **TanStack Query** — only for async/derived/server-touching data (snapshots).
  **Not** the persistence cache — see below.
- **Zustand** stores for persistent client state (`src/stores/`).
- **ShadCN + Tailwind v4** — UI primitives in `src/components/ui/`; SU brand
  theme in `src/index.css` (`@theme` block) + `component-lib` theme.
- **PWA** (`vite-plugin-pwa`, autoUpdate) — installable, offline-capable.

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
  `containerOf` + `sameContainer`, and only when `mode === 'connected'`: a Solo
  user has no Games, so their surfaces render the whole pile unfiltered.
- **Lazy auto-hydration:** first `list(type)` loads from IndexedDB; later reads
  are synchronous.
- **Write-through:** `update`/`create`/`delete` persist to IndexedDB first, then
  update in-memory state; cross-tab writes invalidate via broadcast
  ([ADR-003](../../docs/adrs/ADR-003-zustand-hydration.md)).
- Route persistent entity state through the store, **never** through TanStack
  Query (see `.claude/rules/tanstack-query-hooks.md`).

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
  `ActionsDeck.tsx` / `ActiveItemBand.tsx` as one write-through
  ([ADR-008](../../docs/adrs/ADR-008-sequential-mutations.md),
  [ADR-021](../../docs/adrs/ADR-021-itun-surface-taxonomy.md)).
- Non-destructive heat-check outcomes auto-apply; destructive condition changes
  stay player-driven via the card status badge (`StatusBadge` from
  `component-lib`, wired through `MechItemCard.tsx` → `cycleItemCondition` in
  `src/components/sheet/MechSheet.tsx`)
  ([ADR-007](../../docs/adrs/ADR-007-automation-boundary.md),
  [ADR-009](../../docs/adrs/ADR-009-condition-model-destroyed-color.md)).
- Sheet-side play-control panels (`HeatCheckControl`, `TakeDamageControl`,
  `SalvageControl`, `CraftingControl`, `DowntimeControl`, `ScrapMechControl`)
  were **removed** in the poster redesign — see the header comments in
  `MechSheet.tsx` / `CrawlerSheet.tsx`. Don't reintroduce them; the one surviving
  sheet-local control is `CrawlerEconomyControl.tsx`. (`MediatorRollControl.tsx`
  was the other, in the `/encounter` tray — that whole surface was unreachable
  from anywhere in the app and has been deleted.)
- Full picture: [docs/architecture/combat-loop.md](../../docs/architecture/combat-loop.md).

## Conventions

- Relative imports only (no `@/`); `type` over `interface`; named exports
  (route components may default-export for TanStack Router).
- Reuse `component-lib` components before building new UI; choices stay
  persistence-agnostic in the shared library — ITUN owns the selections
  ([ADR-010](../../docs/adrs/ADR-010-srd-choices-ephemeral-vs-persisted.md)).
- Backup nudge (`src/lib/backupNudge.ts`) tracks un-exported writes — the
  local-first analogue of durability.
- **Do not add a Sentry SDK to `convex/`.** The browser bundle
  (`src/lib/observability.ts`) and the Netlify Functions
  (`netlify/functions/_observability.ts`) each own one; Convex instead uses its
  first-party Exception Reporting integration, enabled in the Convex dashboard
  with no application code (**on for production since 2026-08-05**). Queries and
  mutations run in a deterministic runtime with no `fetch`, so an in-function SDK
  could not report from them at all — rationale and the enable-it runbook are in
  [docs/architecture/accounts-and-games.md](../../docs/architecture/accounts-and-games.md)
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
- **Never insert into an `appId`-addressed table without checking first.**
  `pilots`, `mechs` and `crawlers` are looked up by the client's `appId`, and
  `by_app_id` is an ordinary index — **not** a uniqueness constraint — so
  nothing in the database stops a second row. Prevention is the rule:
  `appIdTaken` before any insert. `convex/maintenance.ts` repairs rows already
  in that state (`dedupeAppIds`, dry-run by default).

  The **lookups themselves no longer throw** on a duplicate. `byAppId` /
  `crawlerByAppId` resolve to the oldest match and `console.warn`, because
  mirrored writes are fire-and-forget: a throw here is invisible to the player,
  so it does not fail the write, it just stops the write from ever reaching the
  server while every surface keeps rendering it as saved. That is how an
  evening of play went missing. A duplicate is a repair job — it is not a reason
  to refuse the write that would have kept client and server in step. The
  warning is the tripwire, and it fires without taking the player's data with
  it. Resolving to the *oldest* is deliberate: it is the row `dedupeAppIds`
  keeps, so a write that lands before the repair runs is not discarded by it.
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
bun run typecheck:itun
```

Deploys to Netlify (SPA + snapshot Functions); config in `netlify.toml`.
