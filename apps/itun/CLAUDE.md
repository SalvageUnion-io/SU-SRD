# itun (ITUN) — Character Builder & Game Manager

React app for building and running Salvage Union pilots, mechs, and crawlers.

**Two storage modes matter when you touch data**
([ADR-030](../../docs/adrs/ADR-030-accounts-games-server-of-record.md), which
supersedes ADR-001):

- **Solo** — not signed in. IndexedDB is the source of truth and nothing is
  gated. **This describes a build with the account gate OFF**, which is what CI,
  a fresh checkout and `bun run dev` get (no `VITE_CONVEX_URL`).
  - **"Forever" no longer holds, and the flip has HAPPENED.**
    [ADR-034](../../docs/adrs/ADR-034-account-required-persistence.md) withdrew
    that guarantee, and every phase of
    [persistence-and-pwa.md](../../docs/architecture/persistence-and-pwa.md) —
    P0–P7, P4b and the flip — is now done.
    `apps/itun/.env.production` sets `VITE_REQUIRE_ACCOUNT=true`, so in **any
    production-mode build** an anonymous visitor gets the in-memory backend:
    writes never reach IndexedDB and do not survive a reload.
  - That distinction is not academic. It is why the nightly e2e was red for a
    month: the Playwright `webServer` builds a production bundle, so the suite
    inherited the gate, entities stopped persisting, and twelve specs failed
    with what looked like selector drift. `playwright.config.ts` now sets
    `VITE_REQUIRE_ACCOUNT=false` explicitly for that build.
  - **Never introduce a store, field or flow that persists only on a device.**
- **Connected / Disconnected** — signed in. Convex is the source of truth and
  IndexedDB becomes a cache. Offline means **read-only**, not a write queue.

Resolve the mode through `src/lib/connection/` — never by reading
`navigator.onLine` or an auth flag directly.

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
- **TanStack Query** — mounted, but **currently unused**: no component calls
  `useQuery`/`useMutation` from `@tanstack/react-query`, and the only two
  importers are the client module and the root provider. Snapshot retrieval runs
  in a TanStack Router loader instead, so the "(snapshots)" this line used to
  claim was already false. Available for genuinely async, non-Convex, cacheable
  work — but **never** the persistence cache (see below), and do not reach for it
  just because it is mounted.
- **Zustand** stores for persistent client state (`src/stores/`).
- **Base UI + Tailwind v4** — UI primitives come from `component-lib` (`ui/`, `chrome/`, `base/`), NOT from an app-local `src/components/ui/`; there is no such directory. SU brand
  theme in `src/index.css` (`@theme` block) + `component-lib` theme.
- **PWA** (`vite-plugin-pwa`, **`registerType: 'prompt'`**) — installable,
  offline-capable. It is `prompt` and must stay that way: `autoUpdate` force-sets
  `skipWaiting` + `clientsClaim` (an assignment in the plugin, not a default, so
  the `workbox` block cannot override it), which activated a new worker under a
  live page and ran `cleanupOutdatedCaches()` — deleting the precache that page
  was still resolving code-split chunks against. Share links wore it worst; see
  the header comments in `vite.config.ts`, `src/lib/sw/register.ts` and
  `src/lib/chunkRecovery.ts`, plus the `/assets/*` → 404 rule in `netlify.toml`
  that stops a rotated-away chunk coming back as `200 text/html`.

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
  (`netlify/lib/observability.ts` — in `lib/`, not `functions/`, because
  everything top-level in a functions directory is deployed as a public
  endpoint) each own one; Convex instead uses its
  first-party Exception Reporting integration, enabled in the Convex dashboard
  with no application code. **Delivering since 2026-08-12**, verified end to end
  rather than assumed: a forced error appeared in `convex logs` and then in
  Sentry as `ITUN-CONVEX-1`, the first event that project had ever received.
  It also forwards `ArgumentValidationError`, not only handler throws.
  Before that it had been recorded as "enabled" on 2026-08-05 while the DSN
  had never actually been pasted into the dashboard, and it sat silent for a
  week — through 39 real mutation failures. **A quiet Sentry project is not
  evidence of a healthy backend**; re-verify by forcing an error and comparing
  against `bunx convex logs --deployment alex-jarvis:suref-itun:prod`, which
  remains the ground truth. Queries and
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

Deploys to Cloudflare Workers (SPA + the snapshot API in one Worker); config in
`wrangler.jsonc`, deployed from `.github/workflows/deploy-cloudflare.yml`.
