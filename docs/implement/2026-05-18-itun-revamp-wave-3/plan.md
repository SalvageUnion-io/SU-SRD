# Plan — itun-revamp-wave-3

Four cycles, file-disjoint by directory boundaries. All branch from
`run/2026-05-18-itun-revamp-wave-3/work` @ TBD-SHA.

## Cycle-1 (Track A): Pilot wizard (#189)

- **ACs covered**: AC-1
- **Issue**: #189
- **Branch**: `run/2026-05-18-itun-revamp-wave-3/cycle-1`
- **Reads from**: `src/stores/` (entityStore), `salvageunion-reference` (Class, Ability, Equipment, RollTable accessors)
- **File paths (owned)**:
  - `apps/in-the-union-now/src/routes/pilots/new.tsx` — wizard entry (TanStack Router file route)
  - `apps/in-the-union-now/src/routes/pilots/index.tsx` — pilot listing (optional; dashboard may cover this)
  - `apps/in-the-union-now/src/components/pilot/PilotWizard.tsx` + step components (`ClassStep.tsx`, `AbilitiesStep.tsx`, etc.)
  - `apps/in-the-union-now/src/components/pilot/RollTableButton.tsx` — shared roll button (if not extracted to shared/)
  - `apps/in-the-union-now/src/components/pilot/__tests__/*.test.tsx` — render + interaction tests

## Cycle-2 (Track B): Mech builder + capacity enforcement (#190)

- **ACs covered**: AC-2
- **Issue**: #190
- **Branch**: `run/2026-05-18-itun-revamp-wave-3/cycle-2`
- **Reads from**: `src/stores/` (entityStore), `src/lib/rules/` (capacity, scrap, cargo), `salvageunion-reference` (Chassis, MechSystem, MechModule)
- **File paths (owned)**:
  - `apps/in-the-union-now/src/routes/mechs/new.tsx` — builder entry
  - `apps/in-the-union-now/src/routes/mechs/index.tsx` — mech listing (optional)
  - `apps/in-the-union-now/src/components/mech/MechBuilder.tsx`
  - `apps/in-the-union-now/src/components/mech/ChassisSelector.tsx`
  - `apps/in-the-union-now/src/components/mech/SystemModuleGrid.tsx`
  - `apps/in-the-union-now/src/components/mech/CargoEditor.tsx`
  - `apps/in-the-union-now/src/components/mech/CapacityIndicator.tsx`
  - `apps/in-the-union-now/src/components/mech/__tests__/*.test.tsx` — capacity-violation tests

## Cycle-3 (Track C): Crawler builder (#191)

- **ACs covered**: AC-3
- **Issue**: #191
- **Branch**: `run/2026-05-18-itun-revamp-wave-3/cycle-3`
- **Reads from**: `src/stores/` (entityStore), `salvageunion-reference` (Crawler, TechLevel, MechSystem)
- **File paths (owned)**:
  - `apps/in-the-union-now/src/routes/crawlers/new.tsx` — builder entry
  - `apps/in-the-union-now/src/routes/crawlers/index.tsx` — crawler listing (optional)
  - `apps/in-the-union-now/src/components/crawler/CrawlerBuilder.tsx`
  - `apps/in-the-union-now/src/components/crawler/TechLevelSelector.tsx`
  - `apps/in-the-union-now/src/components/crawler/BaysEditor.tsx`
  - `apps/in-the-union-now/src/components/crawler/__tests__/*.test.tsx`

## Cycle-4 (Track D): Dashboard + delete + condition (#188 + #197)

- **ACs covered**: AC-4, AC-5
- **Issues**: #188 (delete), #197 (condition tracking)
- **Branch**: `run/2026-05-18-itun-revamp-wave-3/cycle-4`
- **Reads from**: `src/stores/` (entityStore for list/delete/update)
- **File paths (owned)**:
  - `apps/in-the-union-now/src/routes/index.tsx` — REPLACE the Wave 0 placeholder route with the dashboard
  - `apps/in-the-union-now/src/components/dashboard/Dashboard.tsx` — three-tab or three-section listing (pilots, mechs, crawlers)
  - `apps/in-the-union-now/src/components/dashboard/EntityListItem.tsx` — row with name + open + delete
  - `apps/in-the-union-now/src/components/dashboard/DeleteConfirmDialog.tsx` — confirm-then-delete
  - `apps/in-the-union-now/src/components/shared/ConditionToggle.tsx` — intact/damaged/destroyed tri-state toggle (used by mech + pilot views, but the component itself is owned here)
  - `apps/in-the-union-now/src/components/dashboard/__tests__/*.test.tsx` — delete + condition toggle tests

## Dep graph

```
cycle-4 (Dashboard + ConditionToggle)     [no dep on cycles 1/2/3]
cycle-1 (Pilot wizard)                    [no dep on cycle-4 — won't import dashboard]
cycle-2 (Mech builder)                    [conceptually uses ConditionToggle for systems/modules, but Wave 3 scope is the BUILDER (creation flow), not the edit/sheet view; ConditionToggle wiring into mech systems is in cycle-4's purview via the mech detail view, or deferred to Wave 4. Cycle-2 does NOT import ConditionToggle.]
cycle-3 (Crawler builder)                 [no dep on cycle-4]
```

All four cycles dispatch in a single parallel batch — none import from another cycle.

## File-overlap analysis

- `apps/in-the-union-now/src/routes/index.tsx` — owned by Cycle-4 ONLY (replaces Wave 0 placeholder)
- `apps/in-the-union-now/src/routes/pilots/` — owned by Cycle-1 ONLY
- `apps/in-the-union-now/src/routes/mechs/` — owned by Cycle-2 ONLY
- `apps/in-the-union-now/src/routes/crawlers/` — owned by Cycle-3 ONLY
- `apps/in-the-union-now/src/components/pilot/` — owned by Cycle-1 ONLY
- `apps/in-the-union-now/src/components/mech/` — owned by Cycle-2 ONLY
- `apps/in-the-union-now/src/components/crawler/` — owned by Cycle-3 ONLY
- `apps/in-the-union-now/src/components/dashboard/` — owned by Cycle-4 ONLY
- `apps/in-the-union-now/src/components/shared/` — Cycle-4 OWNS ConditionToggle; if any other cycle needs a shared component, it lands there first-writer-wins (document in cycle record). Builders should be self-contained for Wave 3 — extract shared parts in Wave 4 if duplication shows up.
- `apps/in-the-union-now/src/routeTree.gen.ts` — auto-generated by TanStack Router on first build/dev; ANY of the cycles may regenerate it; all should commit only the deterministic output (or leave it for the integrate step). Recommended: each cycle runs `bun --filter in-the-union-now build` once to regenerate, and the resulting routeTree.gen.ts is committed. Conflicts at integrate are RESOLVED by re-running the build after merge (deterministic output).
- `apps/in-the-union-now/package.json` — NO cycle should modify (all UI primitives are already in Wave 0 deps: ShadCN + Tailwind v4 + Zod + TanStack Router/Query + Zustand)
- `bun.lock` — NO cycle should modify

**No-new-deps rule for Wave 3.** All four cycles must build with the existing dep set. If a cycle hits a needs-replan blocker due to a missing dep, STOP and surface — the orchestrator decides whether to fold the dep into a dedicated cycle.

## Aggregate budget allocation

- 4 cycles planned, ≤8 cycles available for remediation/retries (budget 12)
- pr_strategy: one — single PR collecting all four cycles
