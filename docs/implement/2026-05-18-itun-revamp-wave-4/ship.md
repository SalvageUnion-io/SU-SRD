# Phase 5 — Ship

## PR strategy

`one` — single PR from `run/2026-05-18-itun-revamp-wave-4/work` against `yitun-revamp`.

## Run summary

- **Run ID:** `2026-05-18-itun-revamp-wave-4`
- **Base branch:** `yitun-revamp` @ `ec8eeed0`
- **Issues closed:** #192, #195, #194, #196
- **Cycles:** 3 parallel; all clean worker completions (no salvage)
- **Budget used:** 3 of 10 aggregate
- **Review verdict:** APPROVED-WITH-NOTES (orchestrator remediation: jest-dom workaround + type-cast fixes + knip cleanup + recovery from an accidental in-place merge)
- **AC coverage:** AC-1 ✓ AC-2 ✓ AC-3 ✓ AC-4 ✓ AC-5 ✓ AC-6 ✓
- **Tests added:** 79 (17 pattern + 43 wiring/stand-in + 19 soft-warnings)

## Notes for the PR description

- All M1 wiring features land here: mech pattern save/instantiate, soft wiring (mech↔pilot, pilot↔crawler) with no-cascade-delete, auto stand-in placeholders, edit-with-soft-warnings hook + banner.
- DB version bumped 1→2 to register the new `mechPatterns` IndexedDB object store. Existing users will see the upgrade run on next app launch.
- Wire-in to mech/pilot/crawler edit views is deferred — wiring components + SoftWarningBanner exist as standalone modules with tests; threading them into the actual edit JSX is a small follow-up (recommended for M1→M2 transition).
- Orchestrator hit a bash-cwd-drift bug during integrate that accidentally merged cycle-3 into cycle-2; user-approved reset + clean re-integrate restored the proper topology.

## Branch convention

Wave 4 lands on `yitun-revamp` per the locked permanent-integration-branch convention (`docs/itun-revamp/README.md`). All subsequent waves (M2, M3, M4, beyond) also stay on `yitun-revamp` — short of an explicit maintainer decision to merge to main.

## What's left after Wave 4

**M2 (11 stories)**: #198 sheet view, #199 click-to-edit stats, #200/#201 print stylesheets, #202 snapshot backend ADR, #203/#204/#205 snapshot endpoints + share-URL UX, #206 mobile sheet, #207 browser matrix, #208 sheet smoke tests.

**M3 (11 stories)**: #209 Workspace UI, #210/#211 contextual entity displays + deep-links, #212/#213 WCAG AAA sheet / AA elsewhere, #214 60 FPS mobile scroll, #215 TTI, #216 first-build timing, #217 legacy archive policy, #218 deployment swap, #219 baseline metrics.

**M4 (8 stories)**: #220/#221 JSON export/import, #222 comrade display, #223 crawler TL upgrade, #224 pattern snapshot publishing, #225 full rule-utility coverage, #226 dice roller, #227 QR code.

**Deferred follow-ups (from earlier waves):**
- Restore `PilotWizard.test.tsx` (Wave 3 — needs jest-dom test infra wired properly first)
- Wire `SoftWarningBanner` + wiring components into the mech/pilot/crawler edit views (Wave 4 — small)
- Replace placeholder PWA icons before M3 launch (Wave 2)
- Wire `@testing-library/jest-dom` types properly (so future tests don't need the `toBeTruthy()` workaround)
- Remove the dead `src/lib/sw/__mocks__/**` knip ignore

All of these stay on `yitun-revamp` per the locked convention.
