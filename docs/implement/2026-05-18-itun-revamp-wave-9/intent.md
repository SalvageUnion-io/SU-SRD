---
run_id: 2026-05-18-itun-revamp-wave-9
intent: |
  Wave 9 of the ITUN revamp — M3 continues (Polish, A11y & Launch).
  Adds WCAG 2.1 AAA audit + fixes on sheet view (REQ-NF-10), AA audit
  + fixes elsewhere (REQ-NF-11), 60 FPS mobile scroll budget (REQ-NF-03),
  and TTI verification + perf budget (REQ-NF-01).
acceptance_criteria:
  - id: AC-1
    text: "tools/a11y-scan.ts adapted to also scan ITUN routes (sheet/dashboard/builders). bun run a11y-scan exits 0 with zero WCAG 2.1 AAA violations on /sheet/* routes and zero AA violations on /, /dashboard, /pilots/new, /mechs/new, /crawlers/new."
  - id: AC-2
    text: "AAA-critical violations on sheet view fixed: contrast ratios ≥7:1 (large text ≥4.5:1), aria-live regions where appropriate, keyboard navigation works without mouse, focus order logical, focus traps absent."
  - id: AC-3
    text: "AA-critical violations on dashboard/builders fixed: all interactive elements have accessible labels, form fields associated with labels, error messages programmatically associated, focus order matches visual order."
  - id: AC-4
    text: "Sheet rendering audited for perf anti-patterns: large lists use virtualization or pagination if applicable; expensive computations memoized; unnecessary re-renders eliminated via React.memo on stable leaf components. Manual perf-review checklist in cycle-2 record covers iPhone-class device manual verification."
  - id: AC-5
    text: "docs/itun-revamp/perf-budget.md documents the perf budget (TTI ≤ 3s broadband, bundle size targets, main-thread blocking) and the manual lighthouse-review checklist for M3 release."
  - id: AC-6
    text: "bun run check:all is green; PR opens against yitun-revamp closing #212 + #213 + #214 + #215."
out_of_scope:
  - "First-build timing study (#216) — Wave 10."
  - "Legacy archive policy + tag (#217), deployment swap (#218), baseline metrics (#219) — Wave 10."
  - "Real-device FPS / Lighthouse automation — maintainer-run per milestones-data.md §3C."
proposed_ontology_terms:
  - "AAA-critical / AA-critical — WCAG severity tiers used to triage a11y violations for this wave"
  - "Perf budget — documented thresholds (TTI, bundle size, blocking time) that gate M3 release"
  - "Lighthouse review — maintainer-run Lighthouse check producing the TTI baseline"
source:
  kind: prompt
  ref: "deliver invocation 2026-05-18 — Wave 9 of ITUN revamp (M3 continues)"
---

# Intent — itun-revamp-wave-9

Wave 9 continues M3 with a11y + perf gates.

## ACs

- AC-1: a11y-scan adapted + green
- AC-2: AAA-critical fixes on sheet view
- AC-3: AA-critical fixes elsewhere
- AC-4: Perf anti-pattern audit + targeted fixes on sheet
- AC-5: perf-budget.md doc
- AC-6: check:all green + PR

## Out of Scope

- #216 first-build study, #217/#218/#219 launch prep — Wave 10
- Real-device FPS/Lighthouse automation — maintainer-run
