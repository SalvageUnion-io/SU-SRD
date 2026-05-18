# Plan — itun-revamp-wave-7 (closes M2)

3 file-disjoint cycles.

## Cycle-1 (Track A): Mobile-responsive sheet (#206)
- Branch: `run/.../cycle-1`
- Files: small responsive edits to `apps/in-the-union-now/src/components/sheet/{Sheet,PilotSheet,MechSheet,CrawlerSheet,SheetHeader,InlineEditField,PublishButton}.tsx` (sm: variants, min-h-11 for touch targets) + `src/components/sheet/__tests__/mobile-responsive.test.tsx`
- Tests: render at 320px container, verify no overflow + key buttons have ≥44px min-height class

## Cycle-2 (Track B): Browser matrix doc (#207)
- Branch: `run/.../cycle-2`
- Files: `docs/itun-revamp/browser-matrix.md` (NEW; documentation-only)

## Cycle-3 (Track C): Sheet smoke tests (#208)
- Branch: `run/.../cycle-3`
- Files: `apps/in-the-union-now/src/components/sheet/__tests__/sheet-smoke.test.tsx` (NEW) covering all 4 composition modes + click-to-edit + publish flow

## Dep graph

All independent. Cycle-1 modifies sheet component files (small responsive edits); cycle-3 only reads those components via the test renderer. Some file overlap on sheet/__tests__/ is possible if both cycles add files there — separate filenames (`mobile-responsive.test.tsx` vs `sheet-smoke.test.tsx`), no actual conflict.

## Budget

- 3 cycles planned; budget 10
- pr_strategy: one
