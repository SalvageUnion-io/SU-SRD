# Cycle 2 Record — Track B: Rule-Enforcement Utilities

**Run ID:** `2026-05-18-itun-revamp-wave-1`
**Branch:** `run/2026-05-18-itun-revamp-wave-1/cycle-2`
**ACs covered:** AC-4, AC-5
**Issue:** #193

---

## Summary

Implemented four pure-TypeScript rule-enforcement utilities at
`apps/in-the-union-now/src/lib/rules/` along with unit tests for each.
All utilities are side-effect-free (no React, no IndexedDB), and all tests
pass via `bun run check:all`.

---

## Files Touched

| File | Action |
|------|--------|
| `apps/in-the-union-now/src/lib/rules/types.ts` | Created — structural type aliases shared across the module |
| `apps/in-the-union-now/src/lib/rules/capacity.ts` | Created — `computeMechCapacity` |
| `apps/in-the-union-now/src/lib/rules/scrap.ts` | Created — `salvageValueFor`, `scrapCostFor`, `tierUpgradeCost` |
| `apps/in-the-union-now/src/lib/rules/cargo.ts` | Created — `computeCargoCapacity` |
| `apps/in-the-union-now/src/lib/rules/softWarnings.ts` | Created — `evaluateSoftWarnings`, `evaluatePilotWarnings`, `evaluateMechWarnings` |
| `apps/in-the-union-now/src/lib/rules/index.ts` | Created — barrel export |
| `apps/in-the-union-now/src/lib/rules/__tests__/capacity.test.ts` | Created — 13 tests |
| `apps/in-the-union-now/src/lib/rules/__tests__/scrap.test.ts` | Created — 10 tests |
| `apps/in-the-union-now/src/lib/rules/__tests__/cargo.test.ts` | Created — 11 tests |
| `apps/in-the-union-now/src/lib/rules/__tests__/softWarnings.test.ts` | Created — 16 tests |
| `docs/implement/2026-05-18-itun-revamp-wave-1/cycles/cycle-2.md` | Created — this record |

**Did NOT touch:**
- `apps/in-the-union-now/src/lib/schemas/` (cycle-1 owns)
- `apps/in-the-union-now/src/lib/db/` (cycle-1 owns)
- `apps/in-the-union-now/package.json` (no new deps added)
- `apps/in-the-union-now/bunfig.toml` (no preload changes)
- `bun.lock` (no lockfile changes)

---

## AC Coverage

### AC-4 — Four pure-TS rule utilities exist

All four utilities are present:

- **`capacity.ts`** — `computeMechCapacity(mech: MechInput)` looks up chassis slot caps from `SalvageUnionReference.Chassis` (real data) and system/module `slotsRequired` from the respective models. Returns `{ systemSlotsUsed, systemSlotsMax, moduleSlotsUsed, moduleSlotsMax, violations }` with a discriminated-union violation type covering `chassis-not-found`, `system-over-slots`, `module-over-slots`.

- **`scrap.ts`** — `salvageValueFor` and `scrapCostFor` both return `item.salvageValue` (SRD buy=sell rule). `tierUpgradeCost(fromTL, toTL)` reads `CrawlerTechLevels.upgradeCost` from the dataset and sums intermediate upgrade costs for multi-step upgrades.

- **`cargo.ts`** — `computeCargoCapacity(parent, items)` handles both `kind: 'ref'` (resolved against Equipment/Systems/Modules) and `kind: 'custom'` items. Violations: `missing-ref` and `over-capacity`.

- **`softWarnings.ts`** — `evaluateSoftWarnings(before, after, context)` dispatches to `evaluatePilotWarnings` or `evaluateMechWarnings` based on `context.entityType`. Documented cases: ability-prerequisite mismatch, system-dependency removal, tech-level downgrade (with optional scrap-refund-skipped sub-case).

### AC-5 — Unit tests covering happy path + violations + edge cases

50 tests total pass:

| File | Tests | Coverage |
|------|-------|----------|
| `capacity.test.ts` | 13 | Happy path, system-over-slots, module-over-slots, chassis-not-found, exact-max-capacity edge case |
| `scrap.test.ts` | 10 | salvageValueFor, scrapCostFor, tierUpgradeCost: same-level (=0), downgrade (null), single-step, multi-step, max-level (null), real data |
| `cargo.test.ts` | 11 | Empty items, custom items, ref-linked items (real data), mixed, slotCount override, exact-max, over-capacity, missing-ref, both violations simultaneously |
| `softWarnings.test.ts` | 16 | Ability prerequisites (met/unmet/no-minLevel/already-present/multiple), system dependency, TL downgrade + refund-skipped, no-warning paths, dispatch |

---

## Verification

```
bun --filter in-the-union-now test
→ 50 pass, 0 fail

bun --filter in-the-union-now typecheck
→ 0 errors

bun run check:all
→ green (all packages)
```

---

## Notes on Structural Typing (Cycle-1 Dependency Dance)

Because cycle-1 and cycle-2 run in parallel worktrees, the Zod-derived
types from `apps/in-the-union-now/src/lib/schemas/` are not available to
this cycle. To avoid import coupling, all input types for the rule utilities
are defined locally in `rules/types.ts` as structural `type` aliases:

- `MechInput` — describes the shape of a mech entity the rules need
- `PilotSnapshot`, `MechSnapshot` — describe the before/after shapes for soft warnings
- `CargoParent`, `CargoItem` — describe cargo capacity inputs
- `ScrapableItem` — describes items with salvageValue + techLevel

TypeScript's structural type system ensures these aliases are automatically
compatible with whatever Zod-inferred types cycle-1 produces, as long as
the fields match by shape. No nominal coupling required.

The `rules/` module imports directly from `salvageunion-reference` (the
workspace package) for reference data lookups. The package must be built
(`bun run build:package`) before tests run — this is already the documented
prerequisite for the whole monorepo.

**One workaround noted:** The `SalvageUnionReference` lazy-load model
requires `preload()` before any data access. Tests call
`SalvageUnionReference.preload([...])` in `beforeAll`. This adds ~50 ms of
I/O to the test suite but is the correct pattern per the package's own
test suite.
