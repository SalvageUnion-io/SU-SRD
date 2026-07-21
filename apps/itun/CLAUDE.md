# itun (ITUN) — Character Builder & Game Manager

Local-first React app for building and running Salvage Union pilots, mechs, and
crawlers. **No auth, no backend** other than the snapshot-sharing Netlify
Functions ([ADR-001](../../docs/adrs/ADR-001-local-first-no-backend.md),
[ADR-004](../../docs/adrs/ADR-004-snapshot-netlify-functions.md)).

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
  (`src/lib/db/stores.ts`): `pilots`, `mechs`, `crawlers`, `workspaces`,
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

- `entityStore` (pilots/mechs/crawlers/softLinks), plus `workspaceStore`,
  `activeWorkspaceStore`, `patternStore`, `encounterStore`, and the ephemeral
  `playStateStore` (Dashboard mount state).
- **Lazy auto-hydration:** first `list(type)` loads from IndexedDB; later reads
  are synchronous.
- **Write-through:** `update`/`create`/`delete` persist to IndexedDB first, then
  update in-memory state; cross-tab writes invalidate via broadcast
  ([ADR-003](../../docs/adrs/ADR-003-zustand-hydration.md)).
- Route persistent entity state through the store, **never** through TanStack
  Query (see `.claude/rules/tanstack-query-hooks.md`).

## Combat / rules

- Pure math lives in `salvageunion-reference` — `lib/combatUtils.ts` plus
  `lib/rules/` (heat check, take damage, core mechanic, …). `src/lib/rules/` is
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
  `MechSheet.tsx` / `CrawlerSheet.tsx`. Don't reintroduce them; the surviving
  sheet-local controls are `CrawlerEconomyControl.tsx` and the encounter tray's
  `MediatorRollControl.tsx`.
- Full picture: [docs/architecture/combat-loop.md](../../docs/architecture/combat-loop.md).

## Conventions

- Relative imports only (no `@/`); `type` over `interface`; named exports
  (route components may default-export for TanStack Router).
- Reuse `component-lib` components before building new UI; choices stay
  persistence-agnostic in the shared library — ITUN owns the selections
  ([ADR-010](../../docs/adrs/ADR-010-srd-choices-ephemeral-vs-persisted.md)).
- Backup nudge (`src/lib/backupNudge.ts`) tracks un-exported writes — the
  local-first analogue of durability.

## Commands

```bash
bun run dev:itun          # build package + start ITUN dev server
bun --filter itun test
bun run e2e:itun          # Playwright e2e (chromium)
bun run typecheck:itun
```

Deploys to Netlify (SPA + snapshot Functions); config in `netlify.toml`.
