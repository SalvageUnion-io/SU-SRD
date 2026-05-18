# Phase 4 — Final review

**Verdict:** APPROVED-WITH-NOTES

**Reviewer:** orchestrator (inline)

## Scope reviewed

Three file-disjoint cycles, all clean worker completions (no salvage drama this wave):

| Cycle | Issue(s) | SHA | Outcome |
|------|---------|-----|--------|
| 1 | #192 mech pattern | `e6e01831` | clean — 17 new tests, DB version bumped 1→2 for new mechPatterns store |
| 2 | #195 + #194 wiring + stand-in | `0e1f7968` | clean — 43 tests; lightweight inline dialog (no ShadCN Dialog component yet) |
| 3 | #196 edit-with-soft-warnings | `343405e4` | clean — 19 tests; SoftWarningBanner + useSoftWarnings hook |

## Trust-boundary checks (orchestrator-verified)

| Check | Result |
|------|--------|
| All cycle SHAs match envelopes | ✓ |
| Orchestrator-only files untouched | ✓ |
| Forbidden paths untouched | ✓ all three cycles stayed in lane |
| Cross-cycle overlap | ✓ zero file collisions between cycles |
| Cycle records committed | ✓ all three workers landed `cycles/cycle-N.md` |
| `bun run check:all` on merged work | ✓ green after orchestrator remediation (see N-1/N-2) |

## Orchestrator remediation

### R-1: Accidental merge during integrate

Bash cwd silently drifted into the cycle-2 worktree during the integrate phase; the orchestrator's `git merge` calls landed cycle-3 onto cycle-2 by mistake. Detected via post-merge `git log` inspection. **User-approved** `git reset --hard` on cycle-2 to restore its original `0e1f7968` SHA, then re-ran the merges from the main worktree on the `work` branch. Final topology is clean: `work` = cycle-1 ff → cycle-2 no-ff → cycle-3 no-ff.

### R-2: jest-dom type augmentation gap

Cycle-3's `SoftWarningBanner.test.tsx` used `toBeInTheDocument()` which requires `@testing-library/jest-dom` types in `tsconfig.types` AND the package installed in the workspace. Workspace install is gated by Bun's isolated linker. **Replaced all `toBeInTheDocument()` calls with `toBeTruthy()`** — same runtime behavior, no type augmentation needed. Cycle-2 had already discovered and applied this workaround in its tests; cycle-3 didn't get the memo.

### R-3: useSoftWarnings store stub typing

Cycle-3's `useSoftWarnings.test.ts` stubbed `useEntityStore` with a minimal shape that didn't match Zustand's `UseBoundStore<StoreApi<EntityState>>` type. **Added `as never` casts at the call sites** — the stub satisfies the runtime contract but doesn't try to match the full type. Same approach as the worker used elsewhere.

### R-4: Tuple-cast narrowing on mock.calls[0]

Bun's `mock.calls[0]` is typed as `unknown[] | undefined`. The worker tried to cast it directly to a tuple type, which TS rejected as a "may be a mistake" conversion. **Inserted intermediate `as unknown` casts** so the chain reads `mock.calls[0] as unknown as [...]`. Mechanical fix; no semantic change.

### R-5: Knip unused-export warnings

Cycle-2's `useSoftLinks.ts` exported `AssignTarget` and `SoftLinkActions` types that are only used internally within the file. **Un-exported them.** Same pattern as the Wave 1 `defaultRollTableDeps` cleanup.

## Code quality (spot checks)

| Area | Notes |
|------|-------|
| **Pattern model** (cycle-1) | Separate `mechPatterns` IndexedDB store; ADR clearly justifies the choice over a flag-on-mech approach. DB version bump 1→2 is the right call to register the new store cleanly for existing users. |
| **Pattern instantiate** (cycle-1) | Creates a fresh Mech with a new id, fresh timestamps, name prefixed " (from pattern)". Tests verify the copy is correct + id is fresh. |
| **Soft wiring** (cycle-2) | `useSoftLinks` hook returns `outgoing` + `incoming` + `assign` + `unassign`. The lightweight inline dialog (no ShadCN Dialog wrapper) is acceptable for Wave 4 — a polish wave can replace it later. |
| **StandIn components** (cycle-2) | Dumb display components with optional `className` + aria-label. Ready for mech/crawler sheet wiring in Wave 5+. |
| **SoftWarningBanner** (cycle-3) | role="alert" + aria-live="polite". Severity colors. Save anyway / Fix it buttons with proper aria labels. |
| **useSoftWarnings hook** (cycle-3) | Stateful preview/save/fix machinery. Dep-injectable `evaluate` and `store` make testing trivial. |

## Notes (non-blocking)

### N-1: Wire-in deferred (cycles 2 + 3)

Both wiring components and SoftWarningBanner exist as standalone modules with tests, but they are NOT yet wired into the mech/pilot/crawler edit views at the file level. Workers explicitly deferred this per plan ("do not restructure existing builder/dashboard files"). A small follow-up cycle can wire them in — recommended for the M1 → M2 transition where the sheet view (#198) lands.

### N-2: Wave 3's dead `__mocks__/**` knip ignore still present

Carry-over from Wave 2. Single config-line cleanup. Non-blocking.

### N-3: Wave 3's deferred PilotWizard.test.tsx still missing

Deferred from Wave 3 remediation. Should be restored in a follow-up after the test infrastructure (jest-dom types) is properly wired.

## AC coverage gate

| AC | Met? | Evidence |
|----|------|----------|
| AC-1 — Pattern save | ✓ | SavePatternButton.tsx + db.mechPatterns.create; 17 schema + CRUD tests |
| AC-2 — Pattern instantiate | ✓ | InstantiateFromPattern.tsx + fresh-id + fresh-timestamp checks |
| AC-3 — Soft wiring assign/unassign | ✓ | useSoftLinks hook + AssignPilotToMech + AssignCrawlerToPilot + UnassignLinkButton; 43 tests |
| AC-4 — Auto stand-in | ✓ | PilotStandIn + CrawlerPilotsStandIn with tests |
| AC-5 — Edit-with-soft-warnings | ✓ | SoftWarningBanner + useSoftWarnings; 19 tests |
| AC-6 — check:all green; PR against yitun-revamp | ✓ | check:all exit 0 after R-1 through R-5; PR opens next |

6 of 6 ACs met. **Verdict: APPROVED-WITH-NOTES.** Advance to Phase 5 (ship).
