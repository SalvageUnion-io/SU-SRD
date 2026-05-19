# ITUN perf budget

Per PRD REQ-NF-01: TTI ≤ 3s on broadband desktop.

## Budget

| Metric | Budget | Source |
|--------|--------|--------|
| TTI (broadband desktop) | ≤ 3s | REQ-NF-01 |
| Largest Contentful Paint | ≤ 2.5s | Lighthouse default |
| Total Blocking Time | ≤ 200ms | Lighthouse default |
| First Contentful Paint | ≤ 1.8s | Lighthouse default |
| Cumulative Layout Shift | ≤ 0.1 | Lighthouse default |
| Initial JS bundle (gzipped) | ≤ 250KB | M3 release gate |

## Manual lighthouse review (M3 release gate)

1. `bun --filter in-the-union-now build`
2. `bun --filter in-the-union-now preview` (serves the production build)
3. Open Chrome DevTools → Lighthouse → Performance
4. Run in incognito with throttling = "Simulated Slow 4G, 4x CPU slowdown"
5. Verify:
   - [ ] TTI ≤ 3s on broadband simulation
   - [ ] LCP ≤ 2.5s
   - [ ] TBT ≤ 200ms
   - [ ] CLS ≤ 0.1
   - [ ] Bundle size within budget

## Baseline numbers

(To be filled by maintainer at M3 release.)

| Metric | Baseline | Date |
|--------|----------|------|
| TTI | TBD | TBD |
| LCP | TBD | TBD |
| Bundle | TBD | TBD |
