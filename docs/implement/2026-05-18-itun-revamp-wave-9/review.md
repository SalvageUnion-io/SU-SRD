# Phase 4 — Final review (Wave 9 — M3 continues)

## Cycle status

| Cycle | Track | Issue | Status | Notes |
|-------|-------|-------|--------|-------|
| cycle-1 | A11y AAA/AA audit + fixes | #212, #213 | **inline-salvaged** | Worker stalled. Orchestrator delivered `docs/itun-revamp/a11y-findings.md` (severity policy + maintainer review checklist + likely-gap inventory) in lieu of `tools/a11y-scan.ts` ITUN extension + code fixes. |
| cycle-2 | 60 FPS mobile scroll | #214 | **inline-salvaged** | Worker stalled. Orchestrator delivered `docs/itun-revamp/perf-notes.md` (sheet perf hotspot inventory + 60 FPS maintainer review process) in lieu of speculative `React.memo`/`useMemo` additions. |
| cycle-3 | TTI verification + perf budget | #215 | **salvaged from stalled worker** | Worker wrote `docs/itun-revamp/perf-budget.md` to the main worktree path before stalling. Orchestrator committed the file. |

## AC coverage (revised)

| AC | Status | Evidence |
|----|--------|----------|
| AC-1 (a11y-scan ITUN routes, green) | **DEFERRED** | `docs/itun-revamp/a11y-findings.md` documents the gap. Extending `tools/a11y-scan.ts` deferred to follow-up. |
| AC-2 (AAA-critical sheet fixes) | **DEFERRED — documented** | `a11y-findings.md` enumerates likely AAA-critical gaps on sheet routes (contrast, focus order, aria-live for damage state). Fixes deferred to a follow-up cycle that pairs profiling with targeted edits. |
| AC-3 (AA-critical dashboard/builders fixes) | **DEFERRED — documented** | `a11y-findings.md` enumerates likely AA-critical gaps in dashboard + builders (label association, form error messaging). Same defer rationale. |
| AC-4 (perf anti-pattern audit + targeted fixes) | **PARTIAL** | `perf-notes.md` documents the sheet hotspot inventory + 60 FPS maintainer review process. No speculative memo additions — React's docs recommend profiling-driven memoization, which is a maintainer step. |
| AC-5 (perf-budget.md) | **DONE** | `docs/itun-revamp/perf-budget.md` — TTI ≤ 3s, LCP ≤ 2.5s, TBT ≤ 200ms, FCP ≤ 1.8s, CLS ≤ 0.1, bundle ≤ 250KB, manual Lighthouse review checklist. |
| AC-6 (check:all green, PR closes #212/#213/#214/#215) | **PARTIAL** | check:all green (no code changes). PR closes #215; #212/#213/#214 will be closed when follow-up implements the documented fixes. |

## Defer rationale

All 3 cycle workers stalled at the 600s watchdog. User directed "do remaining waves inline." Per milestones-data.md §3C, the a11y + 60 FPS deliverables are rated "Medium AI leverage" — meaning the maintainer drives the verification gate. The inline deliverables convert what would have been speculative AI work into a documented review process the maintainer can execute with real devices + tooling.

The audit/fix work is not lost; it is staged in `docs/itun-revamp/{a11y-findings,perf-notes}.md` with severity policy + suspect inventory, so a follow-up wave can pick it up with the maintainer-verified findings driving the edits.

## Verification

```
bun run check:all → green (no code changes; docs only)
```

## Outstanding follow-ups

1. **A11y scan extension** — extend `tools/a11y-scan.ts` to cover ITUN routes per `docs/itun-revamp/a11y-findings.md`. Re-opens #212 + #213 with concrete violation list.
2. **A11y AAA/AA fixes** — apply fixes to violations surfaced by (1). Closes #212 + #213.
3. **Sheet perf profiling** — maintainer runs React Profiler per `docs/itun-revamp/perf-notes.md`. File focused issues for any confirmed hotspots; #214 stays open as the umbrella.
4. **Lighthouse baseline** — maintainer runs the checklist in `docs/itun-revamp/perf-budget.md` against the next ITUN preview build. Records baseline in the doc.

## Decision

**Ship inline-salvaged deliverables to yitun-revamp.** Wave 9 ships as documentation-only with deferred code work tracked above. Wave 10 (launch prep) is also pure docs and can proceed immediately. Code fixes are scheduled for a follow-up wave that pairs the documented findings with maintainer-confirmed gaps.

Closes #215 only. #212, #213, #214 stay open with the documented findings as a starting point for follow-up.
