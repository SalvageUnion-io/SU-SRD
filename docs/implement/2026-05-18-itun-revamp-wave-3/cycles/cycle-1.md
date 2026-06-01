# Cycle 1 — Pilot wizard (Track A)

**Branch:** `run/2026-05-18-itun-revamp-wave-3/cycle-1`
**Issue:** #189
**ACs covered:** AC-1
**Status:** Worker stalled on 600s watchdog after writing the implementation but before committing. Orchestrator salvaged the uncommitted work from the worker's worktree and is committing it on this cycle branch.

---

## Summary

Multi-step pilot creation wizard at `apps/in-the-union-now/src/routes/pilots/new.tsx` covering: class → abilities → equipment → identity (callsign/motto/keepsake/appearance via roll tables) → background. Wizard is multi-step (5 steps) using React state for step progression and form state; roll-table buttons fire from `salvageunion-reference` via `rollTableHelpers.ts`. Finishing the wizard validates with PilotSchema and calls `useEntityStore.getState().create('pilot', ...)`.

---

## Files (committed by orchestrator from worker worktree)

### Wizard + step components
- `apps/in-the-union-now/src/components/pilot/PilotWizard.tsx` (389 lines) — root wizard component with step state
- `apps/in-the-union-now/src/components/pilot/ClassStep.tsx` (60) — class selection
- `apps/in-the-union-now/src/components/pilot/AbilitiesStep.tsx` (115) — starting ability selection
- `apps/in-the-union-now/src/components/pilot/EquipmentStep.tsx` (77) — starting equipment selection
- `apps/in-the-union-now/src/components/pilot/IdentityStep.tsx` (85) — callsign/motto/keepsake/appearance with roll-table buttons
- `apps/in-the-union-now/src/components/pilot/BackgroundStep.tsx` (43) — background roll-table
- `apps/in-the-union-now/src/components/pilot/RollTableButton.tsx` (30) — shared roll-table trigger
- `apps/in-the-union-now/src/components/pilot/rollTableHelpers.ts` (54) — pure helpers for rolling against salvageunion-reference tables

### Route
- `apps/in-the-union-now/src/routes/pilots/new.tsx` (31) — TanStack Router file route mounting `<PilotWizard />`

### Tests
- `apps/in-the-union-now/src/components/pilot/__tests__/rollTableHelpers.test.ts` (119) — pure-helper coverage
- `apps/in-the-union-now/src/components/pilot/__tests__/PilotWizard.test.tsx` (285) — wizard interaction + entityStore.create on finish

**Total:** 1,288 lines across 11 files.

---

## AC coverage

| AC | Criteria | Evidence |
|----|----------|----------|
| AC-1 | Pilot wizard covers all pilot fields with roll-table integration; no mech/crawler prompt; entityStore.create on finish | PilotWizard renders 5 steps; rollTableHelpers tests verify the roll-against-salvageunion-reference logic; PilotWizard test asserts entityStore.create('pilot', ...) is called with a valid Pilot shape on finish; no mech/crawler imports anywhere in the wizard files (grep verified post-salvage). |

---

## Orchestrator note

Worker stalled on the 600s stream watchdog after writing the implementation files but before running `git add`/`git commit`. Files were intact and well-formed in the worker's worktree. Orchestrator:

1. Verified the worktree was on `run/2026-05-18-itun-revamp-wave-3/cycle-1` (per `git worktree list`)
2. Wrote this cycle record inside the worker's worktree
3. Committed all 11 implementation files + this cycle record on the cycle-1 branch
4. Will re-run `bun run check:all` post-integrate to verify the cycle landed cleanly

The work is the agent's; the orchestrator only provided the commit ceremony. No code changes were made during salvage.
