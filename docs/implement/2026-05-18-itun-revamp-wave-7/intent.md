---
run_id: 2026-05-18-itun-revamp-wave-7
intent: |
  Wave 7 of the ITUN revamp — closes M2 (Sheet, Print & Snapshot Publishing).
  Adds mobile-responsive sheet layout, a browser-matrix verification doc,
  and end-to-end sheet smoke tests. After this wave M2 is complete and
  Wave 8 begins M3.
acceptance_criteria:
  - id: AC-1
    text: "Sheet view renders at 320px viewport with NO horizontal scroll. Touch-target affordances (buttons, InlineEditField hot zones, PublishButton, ConditionToggle) are ≥44px tall on mobile breakpoints (sm: or below). Uses Tailwind responsive classes; no JS viewport detection."
  - id: AC-2
    text: "A mobile-review checklist documented in the cycle-1 record covers manual verification on a real mobile device (iPhone SE-class as the narrowest target) for all four composition modes."
  - id: AC-3
    text: "docs/itun-revamp/browser-matrix.md documents the supported browser matrix (Chrome, Firefox, Safari ≥16, Edge) with a maintainer-run checklist of critical flows (dashboard load, entity creation, sheet view, publish snapshot, share URL fetch). Includes known platform gotchas (Safari IndexedDB quirks, etc.). No code; this is a manual-review gate aid for M3 release."
  - id: AC-4
    text: "A consolidated sheet smoke test at apps/in-the-union-now/src/components/sheet/__tests__/sheet-smoke.test.tsx walks through 8-10 high-value scenarios: pilot/mech/crawler sheet renders, wired composition, stand-in case, click-to-edit round-trip, publish-button click → ShareURLDialog. Uses dep injection (no mock.module())."
  - id: AC-5
    text: "Mobile responsive test verifies that at 320px container width, the sheet renders without overflow and key touch-target buttons exceed the 44px guideline at the computed height (or rendered with min-h-11 / equivalent Tailwind class)."
  - id: AC-6
    text: "bun run check:all is green; PR opens against yitun-revamp closing #206 + #207 + #208 and completing M2."
out_of_scope:
  - "WCAG AAA audit / a11y-scan CI — that's #212 (Wave 8/9 in M3)."
  - "60 FPS mobile scroll — #214 (M3)."
  - "TTI verification — #215 (M3)."
  - "Real browser testing automation — out of scope for the maintainer-reviewed matrix."
proposed_ontology_terms:
  - "Mobile breakpoint — Tailwind sm: (640px) and below; sheet must render cleanly down to 320px"
  - "Touch target — interactive element ≥44px tall on mobile per REQ-NF-12"
  - "Browser matrix — supported browser/version grid + flow checklist"
source:
  kind: prompt
  ref: "deliver invocation 2026-05-18 — Wave 7 of ITUN revamp (closes M2)"
---

# Intent — itun-revamp-wave-7

## Statement

Wave 7 closes M2 with mobile-responsive sheet layout, a browser-matrix
verification doc, and end-to-end sheet smoke tests.

## Acceptance Criteria

- **AC-1** (#206 mobile): Sheet renders at 320px no horizontal scroll; touch targets ≥44px on mobile breakpoints.
- **AC-2** (#206): Mobile-review checklist in cycle-1 record.
- **AC-3** (#207): `docs/itun-revamp/browser-matrix.md` with browser matrix + flows + gotchas.
- **AC-4** (#208): Consolidated sheet smoke test covering 8-10 high-value scenarios.
- **AC-5** (#206): Programmatic mobile responsive smoke test at 320px.
- **AC-6**: check:all green; PR against yitun-revamp; M2 complete.

## Out of Scope

- WCAG AAA, a11y-scan CI, 60 FPS scroll, TTI — M3 stories.
- Real-browser testing automation — manual review only.

## Ontology

- **Reused**: all prior wave terms.
- **Proposed**: Mobile breakpoint, Touch target, Browser matrix.

## Source

- **kind**: prompt
- **ref**: deliver invocation 2026-05-18 — Wave 7 of ITUN revamp (closes M2)
- **bound issues**: #206 + #207 + #208
