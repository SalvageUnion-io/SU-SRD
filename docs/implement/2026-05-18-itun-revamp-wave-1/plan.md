# Plan — itun-revamp-wave-1

Two cycles, file-disjoint, parallel-safe. Both branch from
`run/2026-05-18-itun-revamp-wave-1/work` @ TBD-SHA (set after run-folder
commit).

## Cycle-1 (Track A): IndexedDB persistence + Zod schemas

- **ACs covered**: AC-1, AC-2, AC-3
- **Issue**: #185
- **Branch**: `run/2026-05-18-itun-revamp-wave-1/cycle-1`
- **Worktree**: harness-managed (cycle-1 branched off run branch SHA)
- **Reads from**: nothing (foundational data layer)
- **File paths (touched)**:
  - `apps/in-the-union-now/src/lib/schemas/index.ts` — replace placeholder with real Pilot/Mech/Crawler/Workspace/SoftLink/EntityRef schemas
  - `apps/in-the-union-now/src/lib/schemas/__tests__/*.test.ts` — Zod schema unit tests (required-field rejection per AC-1)
  - `apps/in-the-union-now/src/lib/db/index.ts` — IndexedDB wrapper + inline ADR comment + migration strategy doc
  - `apps/in-the-union-now/src/lib/db/__tests__/*.test.ts` — round-trip + ordering + update-merge + delete + rejection (AC-3)
  - `apps/in-the-union-now/package.json` — add `idb` (or `dexie`) + `fake-indexeddb` deps
  - `apps/in-the-union-now/bunfig.toml` — add `fake-indexeddb/auto` preload for tests
  - `bun.lock` — refresh

## Cycle-2 (Track B): Rule-enforcement utilities + unit tests

- **ACs covered**: AC-4, AC-5
- **Issue**: #193
- **Branch**: `run/2026-05-18-itun-revamp-wave-1/cycle-2`
- **Worktree**: harness-managed
- **Reads from**: `salvageunion-reference` (chassis caps, tech-level rules)
- **File paths (touched)**:
  - `apps/in-the-union-now/src/lib/rules/capacity.ts` — `computeMechCapacity`
  - `apps/in-the-union-now/src/lib/rules/scrap.ts` — `salvageValueFor`, `scrapCostFor`, `tierUpgradeCost`
  - `apps/in-the-union-now/src/lib/rules/cargo.ts` — `computeCargoCapacity`
  - `apps/in-the-union-now/src/lib/rules/softWarnings.ts` — `evaluateSoftWarnings`
  - `apps/in-the-union-now/src/lib/rules/__tests__/*.test.ts` — one test file per utility

## Dep graph

```
cycle-1  (Track A — IndexedDB + schemas)   [no dependencies]
cycle-2  (Track B — rule utilities)        [no dependencies]
```

Both cycles dispatch in a single parallel batch.

## File-overlap analysis

- `apps/in-the-union-now/src/lib/schemas/` owned by Cycle-1
- `apps/in-the-union-now/src/lib/db/` owned by Cycle-1
- `apps/in-the-union-now/src/lib/rules/` owned by Cycle-2
- `apps/in-the-union-now/package.json` — written by Cycle-1 only (Cycle-2 has no new runtime deps; salvageunion-reference is already a workspace dep)
- `apps/in-the-union-now/bunfig.toml` — written by Cycle-1 only (test env additions)
- `bun.lock` — written by Cycle-1 only

**Cycle-2 must NOT add new package.json deps.** If it needs a utility (e.g. for tier math), inline it. If a real dep is needed, surface to the orchestrator as a `needs-replan`.

## Aggregate budget allocation

- 2 cycles planned, ≤6 cycles available for remediation/retries (budget 8)
- pr_strategy: one (single PR collecting both cycles, integrate phase merges them sequentially into the run branch)
