# Plan — itun-revamp-wave-2

Two cycles, file-disjoint, parallel-safe. Both branch from
`run/2026-05-18-itun-revamp-wave-2/work` @ TBD-SHA.

## Cycle-1 (Track A): Zustand entity + workspace stores

- **ACs covered**: AC-1, AC-2, AC-3
- **Issue**: #187
- **Branch**: `run/2026-05-18-itun-revamp-wave-2/cycle-1`
- **Reads from**: `apps/in-the-union-now/src/lib/db/`, `apps/in-the-union-now/src/lib/schemas/` (both Wave 1)
- **File paths (touched)**:
  - `apps/in-the-union-now/src/stores/entityStore.ts` — replace Wave 0 placeholder; wrap db/ CRUD for Pilot/Mech/Crawler/SoftLink
  - `apps/in-the-union-now/src/stores/workspaceStore.ts` — new; wrap db/ workspace CRUD + assignment helpers
  - `apps/in-the-union-now/src/stores/index.ts` — barrel
  - `apps/in-the-union-now/src/stores/__tests__/entityStore.test.ts` — hydration, CRUD, error propagation
  - `apps/in-the-union-now/src/stores/__tests__/workspaceStore.test.ts` — CRUD, assign/unassign, listForWorkspace, listUnassigned
  - `knip.json` — add stores files to new app workspace `entry` (Wave 3 consumes them; without this, knip flags them unused)

## Cycle-2 (Track B): Offline service worker

- **ACs covered**: AC-4, AC-5
- **Issue**: #186
- **Branch**: `run/2026-05-18-itun-revamp-wave-2/cycle-2`
- **Reads from**: nothing (independent infrastructure)
- **File paths (touched)**:
  - `apps/in-the-union-now/src/lib/sw/register.ts` — registration helper with ADR comment
  - `apps/in-the-union-now/src/lib/sw/__tests__/register.test.ts` — registration smoke test (verify navigator.serviceWorker.register call shape)
  - `apps/in-the-union-now/src/main.tsx` — call the registration helper at boot
  - One of:
    - `vite-plugin-pwa` chosen: add devDep, configure in `vite.config.ts`, SW manifest generated automatically
    - Hand-written SW: `apps/in-the-union-now/public/sw.js` + cache-first strategy
  - `apps/in-the-union-now/package.json` (cycle-2 owns this for SW deps; cycle-1 does NOT modify package.json)
  - `bun.lock` (cycle-2 owns lockfile changes)

## Dep graph

```
cycle-1 (Track A — Zustand stores)        [no dependencies on cycle-2]
cycle-2 (Track B — service worker)        [no dependencies on cycle-1]
```

Both cycles dispatch in a single parallel batch.

## File-overlap analysis

- `apps/in-the-union-now/src/stores/` owned by Cycle-1
- `apps/in-the-union-now/src/lib/sw/` owned by Cycle-2
- `apps/in-the-union-now/public/` owned by Cycle-2 (if hand-written SW)
- `apps/in-the-union-now/src/main.tsx` — Cycle-2 only (single import + call addition)
- `apps/in-the-union-now/vite.config.ts` — Cycle-2 only (if vite-plugin-pwa)
- `apps/in-the-union-now/package.json` + `bun.lock` — Cycle-2 only (cycle-1 adds no new deps; zustand is already a Wave 0 dep)
- `knip.json` — Cycle-1 only (for stores entry config)

**Cycle-1 must NOT modify package.json or bun.lock.** Zustand was added in Wave 0.

## Aggregate budget allocation

- 2 cycles planned, ≤6 cycles available for remediation/retries (budget 8)
- pr_strategy: one — single PR collecting both cycles
