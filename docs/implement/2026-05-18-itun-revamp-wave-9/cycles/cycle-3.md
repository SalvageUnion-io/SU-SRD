# Cycle 3 — Track C: TTI verification + perf budget

**Run ID**: 2026-05-18-itun-revamp-wave-9
**Branch**: run/2026-05-18-itun-revamp-wave-9/cycle-3
**ACs covered**: AC-5
**Issue**: #215

## Summary

Documented the performance budget for ITUN per REQ-NF-01. Created `docs/itun-revamp/perf-budget.md` containing:
- Performance budget thresholds (TTI ≤ 3s broadband, LCP ≤ 2.5s, TBT ≤ 200ms, CLS ≤ 0.1, bundle size ≤ 250KB)
- Manual Lighthouse review checklist for M3 release gate
- Baseline metrics table (to be filled by maintainer)

No code changes. Pure documentation.

## Files Touched

| File | Action |
|------|--------|
| `docs/itun-revamp/perf-budget.md` | New — perf budget + Lighthouse review checklist |
| `docs/implement/2026-05-18-itun-revamp-wave-9/cycles/cycle-3.md` | This file |

## AC Coverage

### AC-5 — perf-budget.md documents the perf budget and manual lighthouse-review checklist

**Evidence:** `docs/itun-revamp/perf-budget.md` contains:
- Budget table: TTI ≤ 3s (REQ-NF-01), LCP ≤ 2.5s, TBT ≤ 200ms, FCP ≤ 1.8s, CLS ≤ 0.1, bundle ≤ 250KB
- Step-by-step manual Lighthouse review process (build → preview → DevTools Lighthouse → incognito + throttling)
- 5-item verification checklist (TTI, LCP, TBT, CLS, bundle size)
- Baseline numbers table (placeholder for M3 release)

## Verification

```
bun run check:all → exit 0
```

All checks pass (no code changes, doc-only).

## Design Notes

### Perf budget rationale
- **TTI ≤ 3s**: REQ-NF-01 requirement for broadband desktop
- **LCP ≤ 2.5s, TBT ≤ 200ms, FCP ≤ 1.8s, CLS ≤ 0.1**: Lighthouse default thresholds (green score)
- **Bundle ≤ 250KB**: M3 release gate to maintain startup performance

### Manual review process
The Lighthouse check is maintainer-run (not automated CI) per milestones-data.md §3C. Process:
1. Build production bundle (`bun --filter in-the-union-now build`)
2. Serve locally (`bun --filter in-the-union-now preview`)
3. Run Lighthouse in Chrome DevTools with "Simulated Slow 4G, 4x CPU slowdown" throttling
4. Verify all metrics pass
5. Record baseline numbers in the table

Throttling simulates broadband-on-mobile-cpu, capturing realistic end-user experience.
