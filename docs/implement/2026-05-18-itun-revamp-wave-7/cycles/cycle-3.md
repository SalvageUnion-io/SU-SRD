# Cycle 3 — AC-4: Sheet Pipeline Smoke Tests

**Run:** 2026-05-18-itun-revamp-wave-7  
**Branch:** run/2026-05-18-itun-revamp-wave-7/cycle-3  
**Bootstrap SHA:** 431d853e

## Summary

Implemented AC-4: consolidated end-to-end smoke tests for the entire sheet pipeline. The test file covers 8-10 high-value scenarios via dep-injection (no mock.module()), exercising Sheet, MechSheet, PublishButton, SnapshotPageInner, and the click-to-edit store update path as an integrated pipeline.

## Files Touched

**New files:**
- `apps/in-the-union-now/src/components/sheet/__tests__/sheet-smoke.test.tsx` — 20 passing smoke tests across 10 scenarios

## Scenarios Covered

1. **Pilot-only sheet renders** — pilot name + class ref visible through Sheet → PilotSheet
2. **Mech-only sheet renders** — mech name + system slug visible through Sheet → MechSheet
3. **Crawler-only sheet renders** — crawler name + tech level visible through Sheet → CrawlerSheet
4. **Wired composition** — mech-to-pilot SoftLink → both PilotSheet and MechSheet content visible; PilotStandIn absent
5. **Stand-in case** — mech without pilot link → PilotStandIn visible; pilot content absent
6. **Click-to-edit round-trip** — MechSheet with injected store stub; click HP → type 5 → Enter → store.update called with `{ currentHP: 5 }`
7. **PublishButton click flow** — injected publishFn + entityStore → click Share → ShareURLDialog opens with URL containing snapshot ID
8. **SnapshotPageInner 404 path** — notFound=true → "Snapshot not found" heading + back-to-dashboard link
9. **Read-only mode** — Sheet readOnly=true → no Share button; readOnly=false (default) → Share button present
10. **Composition badge** — correct label (Pilot / Mech / Crawler / Wired) per scenario

## AC Coverage

- AC-4: `sheet-smoke.test.tsx` created with 20 tests spanning the full pipeline; dep-injection throughout (no mock.module()); uses `toBeTruthy()` not `toBeInTheDocument()`.

## Verification

- Tests: 370 pass, 0 fail (20 new smoke tests included)
- TypeScript: 0 errors (`bun run typecheck`)
- Lint: `in-the-union-now` clean; `itun-legacy` has 2 pre-existing warnings (unrelated, exit 0)
- Format: `bun run format` — no changes required

## Notes

- Scenario 6 (click-to-edit) tests `MechSheet` directly rather than through `Sheet` because `Sheet.tsx` does not propagate a `store` prop to `MechSheet`. This still exercises the full `MechSheet → EditableStatRow → InlineEditField → store.update` pipeline.
- Scenario 7 (PublishButton) tests `PublishButton` directly because `Sheet` does not accept a `publishFn` prop. The smoke test validates the publish → dialog flow as a distinct integration scenario.
- The `itun-legacy` lint warnings are pre-existing at the bootstrap SHA and not caused by this cycle's changes.
