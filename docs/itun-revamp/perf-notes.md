# ITUN sheet perf notes (60 FPS mobile scroll)

Per PRD REQ-NF-03. Maintainer-run gate per `ideate/milestones-data.md` §3C.

## Perf hotspot inventory (Wave 9 review)

The sheet pipeline currently renders synchronously without virtualization. Audit identified these hotspots:

| Component | Concern | Mitigation status |
|----------|---------|-------------------|
| `Sheet.tsx` | Composition-mode resolution re-runs on every render | Wrap in `useMemo` keyed on entity + SoftLinks — recommended follow-up |
| `MechSheet.tsx` | Systems + modules list re-render on any prop change | Wrap leaf rows in `React.memo` — recommended follow-up |
| `InlineEditField.tsx` | Every parent re-render forwards a fresh `onSave` prop, breaking memo | Wrap `onSave` in `useCallback` at the parent — recommended follow-up |
| `EditableStatRow.tsx` | Same `onSave` issue | `useCallback` upstream |
| `ConditionToggle.tsx` (Wave 3) | Re-renders on every parent change | Wrap consumers in `React.memo` (don't modify the shared component itself) |

These are the **suspected** hotspots based on code review without profiling. None have been measured. Apply memoization only when a profiler confirms the cost — premature memoization adds maintenance cost without benefit.

## Maintainer 60 FPS review

Follows `docs/itun-revamp/perf-budget.md` "Manual mobile scroll FPS review" section. Run before M3 release deployment.

If FPS dips below 60 on iPhone-class hardware:

1. Open Chrome DevTools Performance tab.
2. Record a scroll session.
3. Identify the longest task (typically > 16.67ms = a dropped frame).
4. Apply the matching mitigation from the hotspot inventory above.
5. Re-run the FPS review.

## Why we didn't pre-emptively memo

Per React docs: avoid `React.memo` / `useMemo` unless profiling shows a measurable perf gain. Wave 9 deliberately ships the perf hotspot inventory + budget instead of speculative memo additions, so the maintainer's profiling drives any real changes.
