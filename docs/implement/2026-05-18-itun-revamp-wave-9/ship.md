# Phase 5 — Ship (Wave 9 — M3 continues)

- Run: `2026-05-18-itun-revamp-wave-9`
- Base: `yitun-revamp` @ `9b2f99b9`
- Issues targeted: #212, #213, #214, #215
- Issues closed by this PR: **#215 only**
- Issues remaining open: **#212, #213, #214** (deferred — see `review.md`)
- M3 progress after merge: ~4/11 stories closed (Waves 8+9); Wave 10 next.

## Deliverables

- `docs/itun-revamp/a11y-findings.md` — WCAG severity policy + maintainer review checklist + likely-gap inventory for AAA/AA scan
- `docs/itun-revamp/perf-notes.md` — sheet perf hotspot inventory + 60 FPS maintainer review process
- `docs/itun-revamp/perf-budget.md` — TTI/LCP/TBT/FCP/CLS/bundle budget + manual Lighthouse review checklist (closes #215)
- `docs/implement/2026-05-18-itun-revamp-wave-9/cycles/{cycle-1,cycle-2,cycle-3}.md` — inline-salvage cycle records

## Defer note

All 3 cycle workers stalled at the 600s watchdog. Per user directive ("do remaining waves inline"), the orchestrator authored the deliverables inline. Code fixes for AAA/AA violations and perf memoization are deferred to a follow-up wave with the documented findings as starting input.

## Next wave

Wave 10 — launch prep (docs-only): #216 first-build study, #217 legacy archive policy + tag, #218 deployment swap, #219 baseline metrics.
