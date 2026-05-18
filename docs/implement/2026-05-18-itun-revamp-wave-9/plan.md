# Plan — itun-revamp-wave-9

3 parallel cycles.

## Cycle-1 (Track A): a11y AAA + AA fixes (#212 + #213)
Files:
- `tools/a11y-scan.ts` — extend to scan ITUN routes
- `apps/in-the-union-now/src/index.css` — contrast fixes if needed
- Various component files — aria labels, focus management, keyboard nav (small surgical edits)
- Cycle record documents violations found + fixed + deferred (cosmetic)

## Cycle-2 (Track B): 60 FPS perf audit (#214)
Files:
- `apps/in-the-union-now/src/components/sheet/*` — targeted memo/useMemo additions
- `apps/in-the-union-now/src/components/sheet/__tests__/perf.test.tsx` (NEW) — smoke test that asserts memo'd components don't re-render unnecessarily
- Cycle-2 record with manual perf-review checklist

## Cycle-3 (Track C): TTI + perf budget (#215)
Files:
- `docs/itun-revamp/perf-budget.md` — NEW perf budget + manual review checklist
- Optional: `apps/in-the-union-now/lighthouserc.json` or similar if CI lighthouse is added
- Cycle record with baseline numbers if lighthouse was run locally

## Dep graph: independent. Budget 10.
