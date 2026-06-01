# Cycle-1 Completion Record — Mech Pattern Save/Instantiate (#192)

**Run**: 2026-05-18-itun-revamp-wave-4
**Branch**: `run/2026-05-18-itun-revamp-wave-4/cycle-1`
**ACs covered**: AC-1, AC-2

---

## Summary

Implemented mech pattern save/instantiate (Wave 4, Track A). A user can save any mech's configuration (chassis, systems, modules, cargo) as a named reusable Pattern, then instantiate it into a fresh Mech with a new id and fresh timestamps.

---

## Files Touched

| File | Action |
|------|--------|
| `apps/in-the-union-now/src/lib/schemas/pattern.ts` | NEW — MechPatternSchema (Zod, `.strict()`, schemaVersion literal) |
| `apps/in-the-union-now/src/lib/db/stores.ts` | MODIFIED — added `mechPatterns: 'mechPatterns'` to STORE_NAMES |
| `apps/in-the-union-now/src/lib/db/index.ts` | MODIFIED — bumped DB to version 2 with `oldVersion < 2` upgrade guard; added `mechPatterns` accessor |
| `apps/in-the-union-now/src/components/mech/Pattern/SavePatternButton.tsx` | NEW — Button + inline dialog for naming/saving a pattern |
| `apps/in-the-union-now/src/components/mech/Pattern/PatternList.tsx` | NEW — Lists all saved patterns; delegates instantiation to InstantiateFromPattern |
| `apps/in-the-union-now/src/components/mech/Pattern/InstantiateFromPattern.tsx` | NEW — Button that creates a fresh Mech from a MechPattern via entityStore.create |
| `apps/in-the-union-now/src/routes/mechs/patterns/index.tsx` | NEW — TanStack Router file route rendering PatternList; navigates to `/` on instantiation |
| `apps/in-the-union-now/src/routeTree.gen.ts` | REGENERATED — includes `/mechs/patterns/` route |
| `apps/in-the-union-now/src/components/mech/MechBuilder.tsx` | MODIFIED — added SavePatternButton to submit row (conditionally rendered when chassis selected) |
| `apps/in-the-union-now/src/components/mech/Pattern/__tests__/pattern.test.ts` | NEW — 17 tests covering schema validation, CRUD round-trips, and instantiate path |

---

## ADR: Separate `mechPatterns` Object Store

**Decision**: Patterns live in a dedicated `mechPatterns` IndexedDB object store, added via a version-2 upgrade guard in `db/index.ts`.

**Rejected path**: Storing patterns as a boolean flag on Mech records. This would require filter-on-read for every mech list query (IndexedDB has no native predicate index without explicit `createIndex`), and couples two distinct concerns (live entities vs reusable templates).

**Accepted path** (Path A from plan): Narrow extension of `STORE_NAMES` in `stores.ts` + version bump in `index.ts`. The version-2 upgrade uses `oldVersion < 2` so existing v1 databases get the new store on next page load. The `_clearAllStores()` test helper automatically includes `mechPatterns` because it iterates `Object.values(STORE_NAMES)`.

**MechPattern has no `updatedAt`** — patterns are treated as immutable templates. `hasUpdatedAt: false` is passed to `makeStore`, matching the Workspace/SoftLink pattern.

**Fallback (Path B not taken)**: A separate `db/patterns.ts` file with its own `openDB` call was the documented fallback if Path A caused integrate conflicts. Path A was straightforward and did not conflict.

---

## DB Version Note

The `openDB` call was bumped from version 1 to version 2. The upgrade callback is split by `oldVersion < N` guards, following the ADR in `db/index.ts` ("add a case per version"). This ensures that:
- New installs: both v1 and v2 stores created in one upgrade pass
- Existing v1 installs: only the `mechPatterns` store added

---

## MechBuilder Integration

`SavePatternButton` was added to `MechBuilder.tsx` as a conditional 8-line addition (conditionally rendered when a chassis is selected). This is a clean integration — no restructuring required. The button sits alongside the "Create Mech" button in the submit row.

---

## AC Coverage

| AC | How satisfied |
|----|--------------|
| AC-1 | `SavePatternButton` captures chassis/systems/modules/cargo + a user-supplied name; persists via `db.mechPatterns.create()`. Inline ADR at top of `pattern.ts` documents the persistence model. |
| AC-2 | `InstantiateFromPattern` copies pattern fields into a fresh Mech input, calls `entityStore.create('mech', ...)`, and the new mech receives a new id + fresh timestamps from the db layer. The mech appears in the dashboard when the route navigates to `/`. |

---

## Verification

```
bun --filter in-the-union-now typecheck   → 0 errors
bun --filter in-the-union-now test        → 193 pass, 0 fail (17 new)
bun run check:all                         → exit code 0
```

Test file: `apps/in-the-union-now/src/components/mech/Pattern/__tests__/pattern.test.ts`
Test command: `bun --filter in-the-union-now test`

---

## File Ownership Compliance

- Did NOT touch `src/components/wiring/**` (cycle-2)
- Did NOT touch `src/components/shared/**` (cycles 2/3)
- Did NOT touch `src/components/{pilot,crawler,dashboard}/`
- Did NOT touch anything outside `apps/in-the-union-now/`
- Did NOT touch orchestrator files (only wrote `cycles/cycle-1.md`)
