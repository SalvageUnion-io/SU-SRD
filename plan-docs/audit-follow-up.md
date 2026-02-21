# Monorepo Audit — Follow-Up Items

Remaining items from the 2026-02-20 comprehensive monorepo audit, organized by priority.

## Completed — Session 1 (2026-02-20)

1. **Fix cargo realtime filter bug** — `useCrawlerSheet.tsx:78` `crawler_id` → `parent_id`
2. **Delete stale `.new` favicon files** — 6 files removed from `apps/suref-web/public/`
3. **Delete stale nested `bun.lock`** — Removed from `packages/salvageunion-reference/`
4. **Remove unused `@randsum/salvageunion`** — Removed from ITUN dependencies
5. **Netlify security headers** — Removed `X-XSS-Protection`, added HSTS, cleaned CSP `font-src`
6. **Self-host Fira Code in ITUN** — Copied woff2, added `@font-face`, added cache header
7. **Replace `tsx` with `bun run`** — All tool scripts in salvageunion-reference now use `bun`
8. **Supabase migration file** — Created `20260220_audit_fixes.sql` with:
   - Missing indexes (`campaigns.crawler_id`, `player_choices.parent_choice_id`, composite indexes)
   - RLS `auth.uid()` → `(select auth.uid())` optimization for all tables
   - Polymorphic cleanup trigger on pilots/mechs/crawlers → entity_refs/cargo/player_choices
   - Unique constraint on `player_choices(parent_id, parent_type, choice_id)` for upsert
9. **`playerChoiceApi.ts` upsert** — Replaced manual SELECT+INSERT/UPDATE with `.upsert()`

## Completed — Session 2 (2026-02-20)

10. **Pre-stamp `schemaName` + ID maps in BaseModel** — Stamped `schemaName` at construction, built `Map<string, T>` for O(1) `getById()`, removed `addSchemaName()`. `.all()` returns data directly.
11. **Simplify `SalvageUnionReference.get()`** — Replaced `entityCache` + `findIn()` with direct `model.getById()`.
12. **suref-web deferred hydration** — Changed `client:load` → `client:idle` on SchemaViewerIsland and ReferenceEntityIsland.
13. **suref-web game data chunk** — Added `game-data` chunk to `astro.config.mjs`.
14. **Remove dead `SheetInput` component** — Deleted `SheetInput.tsx` and `SheetInput.stories.tsx` from suref-react.
15. **`useCurrentUser()` convenience hook** — Replaced 15 occurrences of `useAuthStore((s) => s.user)` across 13 files.
16. **Consolidate tech level color maps** — Added `TECH_LEVEL_BG` to `techLevelStyles.ts`, replaced local `techLevelColors` in `useReferenceEntityDisplayState.ts`.
17. **Consolidate cargo API duplication** — Created `cargoApi.ts` + `useCargo.ts` shared hooks, removed ~160 lines of duplicate code from `mechApi.ts` and `crawlerApi.ts`.
18. **Compute `extractComrades` once** — Computed in `usePilotSheet`, passed as prop to `ActionsSection`, `PlayerPilotDisplay`, `ComradesSection`.
19. **`listGames` N+1 query** — Replaced two sequential queries with single Supabase join via `campaign_members.select('campaigns!inner(*)')`.
20. **Optimistic updates for stat mutations** — Added `onMutate`/`onError` optimistic update pattern to `useUpdatePilot`, `useUpdateMech`, `useUpdateCrawler`.
21. **`React.memo` on list items** — Wrapped `EntityStorageItem`, `CustomStorageItem`, `MemberRow`, `PilotAssignmentRow` with `React.memo()`.
22. **Fix `dist/` prettierignore** — Added `.prettierignore` to ITUN and discord-bot so Prettier skips build artifacts.
23. **ITUN Vite manualChunks** — Investigated and determined TanStack Start manages its own chunk splitting; custom `manualChunks` conflicts with Rollup's SSR bundling. Documented in vite.config.ts comment.

## Completed — Session 3 (2026-02-20)

24. **Fix `as never` type assertions** — Defined narrow `ActionCostInput` type in `actionUsesUtils.ts`, changed disabled-reason functions from `SURefMetaAction` to `ActionCostInput`, removed both `as never` casts in `ActionsSection.tsx`.
25. **Route-level error boundaries** — Added `errorComponent: ErrorFallback` to `_authenticated.tsx`, `pilots/$pilotId.tsx`, and `games/$gameId.tsx` layout routes.
26. **Separate UI state from CrawlerEditConfig** — Moved `showDelete`, `showTranslateDialog`, `editingWeaponSlot`, and `weaponSlotControls` from `useCrawlerSheet` hook to `PlayerCrawlerDisplay` component. Changed `onWeaponChange` to accept slot parameter.
27. **Remove dead `showDelete`/`setShowDelete` from usePilotSheet** — Removed unused `useState`, cleaned up return object.
28. **Consolidate duplicate comrade hooks** — Created generic `usePlayerChoiceValue` hook with shared query + realtime + mutation + local state pattern. Refactored `useComradeEp` and `useComradeChoices` to delegate to it.
29. **Consolidate schema name maps** — Added single `SCHEMA_REGISTRY` in `salvageunion-reference/lib/index.ts`. Derived `EntitySchemaNames`, `SchemaToModelMap`, and `SchemaToDisplayName` from the registry. Adding a new schema now requires one entry instead of four.
30. **Add comradeUtils tests** — Created `comradeUtils.test.ts` with 8 test cases covering empty inputs, stat-bearing equipment extraction, deduplication, source parent tracking, missing refs, and drone-granting chassis.
31. **Fix `upgradeTechLevel` race condition** — Added conditional `.eq('tech_level', ...)` and `.gte('upgrade_pool', ...)` guards to the update query in `crawlerApi.ts`. Uses `.maybeSingle()` to detect conflict and throw user-friendly error.
32. **Parallelize root scripts** — Added `concurrently` dev dependency. `typecheck` now runs salvageunion-reference first, then remaining three in parallel. `check:all` runs lint+format in parallel, then typecheck, then test+validate in parallel.
33. **Activity feed client-side scoping** — Added optional `relevantEntityIds` parameter to `useActivityFeed`. Filters incoming payloads by `target_id` membership. Updated both callers (game index, crawler sheet) to pass relevant entity IDs. Uses stable channel name per user.

---

## TIER 1 — High-Impact Wins

### 1. Split `usePilotSheet` God Hook (405 lines)
**Effort:** Medium | **Risk:** Medium

Aggregates 6 query hooks, 6 mutation hooks, 4 realtime subscriptions, 1 save tracker, 10+ callbacks. Causes unnecessary re-renders.

**Fix:** Split into `usePilotData`, `usePilotMutations`, `usePilotRealtime`, `usePilotSaveStatus`.

### 2. Eager Loading of All Game Data at Import Time
**Effort:** Medium-Large | **Risk:** Medium

`ModelFactory.ts` imports ALL 26 JSON data + 26 JSON schema files via static `import ... with { type: 'json' }`. First import forces parsing ~1.4MB of JSON.

**Fix (phased):**
- **Quick win:** Move schema map to a separate entry point (`salvageunion-reference/schemas`)
- **Future:** Lazy-load data per schema via dynamic `import()`

---

## TIER 2 — Medium-Impact Improvements

### 3. `select('*')` Over-Fetching
18 instances of `.select('*')`. Add explicit column lists to list endpoints.

### 4. ~~`upgradeTechLevel` Race Condition~~ → Completed (Session 3, #31)

### 5. ~~Quadruple-Redundant Schema Name Maps~~ → Completed (Session 3, #29)

### 6. ~~Duplicate `useComradeEp` / `useComradeChoices`~~ → Completed (Session 3, #28)

### 7. ~~Separate UI State from `CrawlerEditConfig`~~ → Completed (Session 3, #26)

### 8. `export *` Barrel Re-exports
`lib/index.ts:55,58` — `export * from './utilities.js'` re-exports ~100 functions. Explicit named exports improve tree-shaking.

### 9. Missing Tests for Critical Code
- ~~`comradeUtils.ts` (103 lines) — zero tests~~ → Completed (Session 3, #30)
- `ReferenceEntityDisplayContent` (588 lines) — zero tests
- `BlockContentRendererView`, `DataValueDisplayView`, `ClassAbilityTreeDisplay` — zero tests

---

## TIER 3 — Low-Impact / Cleanup

### 10. Parallelize Root Scripts
`typecheck` and `check:all` run sequentially. Needs a proper parallel runner (`concurrently` or `npm-run-all`) since bash `wait` doesn't propagate exit codes.

### 11. Large File Decomposition
- `ActionsSection.tsx` (763 lines)
- `CrawlerStorageSection.tsx` (683 lines)
- `PlayerPilotDisplay.tsx` (597 lines)
- `routes/_authenticated/games/$gameId/index.tsx` (569 lines)

### 12. Route-Level Error Boundaries
Only root route has `errorComponent`. Add per-route error components.

### 13. `as never` Type Assertions
`ActionsSection.tsx:439,454` — Utility functions should accept minimal shape instead.

### 14. Add CI Workflow
No `.github/workflows/`. Simple GitHub Actions running `check:all` on PRs.

### 15. Weak Type Guards in salvageunion-reference
`utilities.ts:1019-1151` — Many guards check only common fields, returning true for any entity.

### 16. Route-Level Data Prefetching
No routes use TanStack Router's `loader`/`beforeLoad`. Dashboard could prefetch.

---

## SUPABASE — Remaining Database Items

### Non-Atomic Multi-Table Operations (7 Race Conditions)
**Priority: Critical for multiplayer**

| Function | File | Risk |
|----------|------|------|
| `createGame` | `gameApi.ts:47` | Orphan campaign if member insert fails |
| `createPilot` | `pilotApi.ts:26` | Pilot with no abilities if entity_refs fails |
| `createCrawler` | `crawlerApi.ts:14` | Orphan crawler if entity_refs fails |
| `instantiateMechFromPattern` | `mechApi.ts:14` | Orphan mech if entity_refs fails |
| `updateMechEntityRefs` | `mechApi.ts:93` | Items lost if insert fails after delete |
| `updateCrawlerWeapon` | `crawlerApi.ts:228` | Old weapon deleted, new one fails |
| `joinGame` | `gameApi.ts:92` | TOCTOU race window |

**Fix:** Migrate to Supabase RPC functions with `BEGIN/COMMIT`.

### Activity Feed: No Server-Side Filtering
`useActivityFeed.ts` subscribes to ALL `change_log` inserts. Add realtime filter or RLS on SELECT.

### Database View Opportunities
- **Pilot roster view** — Join pilots + mechs + entity_refs (replaces 3-query waterfall)
- **Game dashboard view** — Replace multi-query pattern

---

## Package Adoption Opportunities

| Package | Purpose | Where |
|---------|---------|-------|
| `@tanstack/query-devtools` | Debug query cache | ITUN |
| `vite-plugin-compression` | Pre-compress with Brotli/gzip | Both apps |
| `unplugin-icons` | Tree-shakeable icons (replace lucide barrel) | ITUN |
| `concurrently` | Parallel script runner with exit code propagation | Root |
