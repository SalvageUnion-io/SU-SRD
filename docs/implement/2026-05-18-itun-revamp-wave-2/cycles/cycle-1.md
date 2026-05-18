# Cycle-1 Record — itun-revamp-wave-2 (Track A)

## Summary

Implemented the Zustand entity + workspace stores wrapping the Wave 1 IndexedDB CRUD layer. Replaced the Wave 0 placeholder `stores/index.ts` with a full barrel exporting `useEntityStore`, `useWorkspaceStore`, and shared types. Added 14 unit tests covering hydration, CRUD write-through, Zod error propagation, and workspace assignment semantics.

## Files Touched

| File | Action |
|------|--------|
| `apps/in-the-union-now/src/stores/types.ts` | New — shared conditional types (EntityForType, CreateInput, AssignableType) |
| `apps/in-the-union-now/src/stores/appStore.ts` | New — extracted Wave 0 `useAppStore` into its own file (preserves scaffold test compatibility) |
| `apps/in-the-union-now/src/stores/entityStore.ts` | Replaced Wave 0 stub — Zustand store wrapping db/ CRUD for Pilot/Mech/Crawler/SoftLink |
| `apps/in-the-union-now/src/stores/workspaceStore.ts` | New — Workspace CRUD + assign/unassign helpers |
| `apps/in-the-union-now/src/stores/index.ts` | Replaced Wave 0 placeholder — barrel exporting all stores + types |
| `apps/in-the-union-now/src/stores/__tests__/entityStore.test.ts` | New — 8 tests (hydration, CRUD, Zod error) |
| `apps/in-the-union-now/src/stores/__tests__/workspaceStore.test.ts` | New — 6 tests (CRUD, assign, unassign, listForWorkspace) |
| `knip.json` | Added new stores files to `apps/in-the-union-now` entry array |
| `docs/implement/2026-05-18-itun-revamp-wave-2/cycles/cycle-1.md` | This file |

## AC Coverage

### AC-1 — entityStore wrapping db/ CRUD
**Evidence:** `apps/in-the-union-now/src/stores/entityStore.ts` exports `useEntityStore` with `hydrate / list / get / create / update / delete` for all four entity types. All operations delegate to the corresponding `db.*` accessor. Typecheck clean; `bun run check:all` green.

### AC-2 — workspaceStore with CRUD + assign/unassign
**Evidence:** `apps/in-the-union-now/src/stores/workspaceStore.ts` exports `useWorkspaceStore` with `hydrate / list / get / create / rename / delete / assign / unassign / listForWorkspace / listUnassigned`. `assign/unassign` delegate to `useEntityStore.update()` so entity in-memory state stays authoritative.

### AC-3 — Unit tests passing under happy-dom + fake-indexeddb
**Evidence:** `bun test src/stores/__tests__/` passes 14 tests across 2 files in 147ms. `bun run check:all` exits 0.

## Verification

```
bun --filter in-the-union-now typecheck    → clean (0 errors)
bun test src/stores/__tests__/             → 14 pass, 0 fail (44 expect() calls)
bun test (full ITUN suite)                 → 116 pass, 0 fail
bun run check:all                          → exit 0
```

## Design Notes

### Hydration strategy — lazy auto-hydration
When `list(type)` or `get(type, id)` is called and the type is not yet hydrated, `hydrate(type)` is triggered automatically (fire-and-forget for sync reads). Callers that need a guaranteed fresh result before reading should `await useEntityStore.getState().hydrate(type)` first. This is friendlier than throwing "not hydrated" and matches the pattern used in the Wave 0 placeholder's `setInitialized` convention.

### Workspace-delete semantics — no cascade
Deleting a workspace does NOT clear `workspaceId` on associated entities. Entities keep their `workspaceId` field pointing at the now-deleted workspace, making them "orphaned": they won't appear in `listForWorkspace()` (workspace gone from store) or `listUnassigned()` (they still have a non-null workspaceId). Callers must explicitly `unassign()` entities before or after workspace deletion if they want entities to return to the unassigned pool. This matches the "soft reference / non-cascading" pattern established in `SoftLinkSchema` throughout the codebase.

### Assignment helpers — entityStore as authoritative source
`assign/unassign` in workspaceStore delegate to `useEntityStore.getState().update()` rather than writing directly to db. This ensures the entityStore's in-memory state stays consistent and `listForWorkspace/listUnassigned` (which read from entityStore's in-memory arrays) always reflect the current assignment state.

### Wave 0 useAppStore
Extracted into `stores/appStore.ts` and re-exported from the barrel to avoid breaking the existing `test/scaffold.test.ts` which imports `useAppStore`. The store itself is a trivial initialized-flag store with no behavior relevant to AC-1/2/3.

### ESLint suppressions
Two `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comments in `entityStore.ts` are unavoidable: the db CRUD generics (`EntityStore<T>.create/update`) accept `Omit<T, 'id'|'createdAt'|'updatedAt'>` which is not directly composable with the store's conditional type `EntityForType<T>` across the discriminated union without `any` at the call site. The `any` is fully contained within the store — external callers see properly typed returns.
