# Plan — itun-revamp-wave-4

Three cycles, file-disjoint by directory. All branch from
`run/2026-05-18-itun-revamp-wave-4/work` @ TBD-SHA.

## Cycle-1 (Track A): Mech pattern save/instantiate (#192)

- **ACs covered**: AC-1, AC-2
- **Issue**: #192
- **Branch**: `run/2026-05-18-itun-revamp-wave-4/cycle-1`
- **Reads from**: `src/stores/entityStore`, `src/lib/schemas/mech`, `src/lib/db/`
- **File paths (owned)**:
  - `apps/in-the-union-now/src/lib/schemas/pattern.ts` — new MechPatternSchema (Zod, .strict())
  - `apps/in-the-union-now/src/lib/db/stores.ts` — add `mechPatterns` store registration (touches Wave 1 file — acceptable narrow extension via single new store registration; document in cycle record). If this proves contentious at integrate, fall back to a parallel db file (`src/lib/db/patterns.ts`) so the original stores.ts is untouched.
  - `apps/in-the-union-now/src/lib/db/index.ts` — barrel export for the new store (same caveat as above)
  - `apps/in-the-union-now/src/components/mech/Pattern/SavePatternButton.tsx`
  - `apps/in-the-union-now/src/components/mech/Pattern/PatternList.tsx`
  - `apps/in-the-union-now/src/components/mech/Pattern/InstantiateFromPattern.tsx`
  - `apps/in-the-union-now/src/routes/mechs/patterns/index.tsx` — list patterns
  - `apps/in-the-union-now/src/routes/mechs/patterns/$id.tsx` — view/instantiate (optional)
  - `apps/in-the-union-now/src/components/mech/Pattern/__tests__/*.test.tsx` — save round-trip + instantiate fresh-id check

**ADR (inline at top of pattern.ts):** Patterns are a NEW entity type stored in a dedicated IndexedDB object store. Rejected: storing patterns as a flag on Mech records (would require complex filtering on every mech list query). Accepted: separate store keeps mech queries clean and lets patterns evolve their own schema.

**Cross-cycle note:** If cycle-1 modifying `src/lib/db/stores.ts` conflicts with anything cycle-2/3 touch, the orchestrator resolves at integrate. The fallback `src/lib/db/patterns.ts` parallel-file path keeps integrate clean if conflicts arise.

## Cycle-2 (Track B): Soft wiring + auto stand-in (#195 + #194)

- **ACs covered**: AC-3, AC-4
- **Issues**: #195 (wiring), #194 (stand-in)
- **Branch**: `run/2026-05-18-itun-revamp-wave-4/cycle-2`
- **Reads from**: `src/stores/entityStore` (list/create/delete SoftLink), `src/lib/schemas/softLink` (Wave 1)
- **File paths (owned)**:
  - `apps/in-the-union-now/src/components/wiring/AssignPilotToMech.tsx`
  - `apps/in-the-union-now/src/components/wiring/AssignCrawlerToPilot.tsx`
  - `apps/in-the-union-now/src/components/wiring/UnassignLinkButton.tsx`
  - `apps/in-the-union-now/src/components/wiring/useSoftLinks.ts` — hook returning SoftLinks for a given entity
  - `apps/in-the-union-now/src/components/wiring/__tests__/*.test.tsx`
  - `apps/in-the-union-now/src/components/shared/PilotStandIn.tsx` — dumb display
  - `apps/in-the-union-now/src/components/shared/CrawlerPilotsStandIn.tsx` — dumb display
  - `apps/in-the-union-now/src/components/shared/__tests__/StandIns.test.tsx`

**Cross-cycle note:** stand-in components live in `src/components/shared/` and are owned by cycle-2. Cycle-3 owns SoftWarningBanner + SoftWarningDialog in the same directory — strictly different filenames, no overlap.

## Cycle-3 (Track C): Edit-with-soft-warnings (#196)

- **ACs covered**: AC-5
- **Issue**: #196
- **Branch**: `run/2026-05-18-itun-revamp-wave-4/cycle-3`
- **Reads from**: `src/stores/entityStore`, `src/lib/rules/softWarnings` (Wave 1)
- **File paths (owned)**:
  - `apps/in-the-union-now/src/components/shared/SoftWarningBanner.tsx`
  - `apps/in-the-union-now/src/components/shared/SoftWarningDialog.tsx` (only if a modal confirm is preferred over inline banner; cycle-3's choice — document)
  - `apps/in-the-union-now/src/components/shared/useSoftWarnings.ts` — hook that wraps entityStore.update with before/after snapshot + warning evaluation
  - `apps/in-the-union-now/src/components/shared/__tests__/SoftWarningBanner.test.tsx`
  - `apps/in-the-union-now/src/components/shared/__tests__/useSoftWarnings.test.ts`

**Wire-in:** Wave 4 ships these components but does NOT necessarily wire them into the mech/pilot edit views at the file level — that's a small follow-on (which could land in this PR if cycle-3 has bandwidth, but only as a TODO/comment in the relevant view if file-modification scope is risky). Defer the actual mech-view-wires to a Wave 5 polish cycle if it creates merge conflicts with cycle-1's Pattern additions.

## Dep graph

```
cycle-1 (Pattern)              [no deps on cycle-2/3]
cycle-2 (Wiring + StandIn)     [no deps on cycle-1/3]
cycle-3 (SoftWarnings)         [no deps on cycle-1/2]
```

All three dispatch in a single parallel batch.

## File-overlap analysis

| Path | Owner |
|------|-------|
| `src/lib/schemas/pattern.ts` | Cycle-1 only |
| `src/lib/db/stores.ts` | Cycle-1 only (narrow extension; fallback to `patterns.ts` if needed) |
| `src/components/mech/Pattern/**` | Cycle-1 only (new subdirectory) |
| `src/routes/mechs/patterns/**` | Cycle-1 only |
| `src/components/wiring/**` | Cycle-2 only (new directory) |
| `src/components/shared/PilotStandIn.tsx` | Cycle-2 only |
| `src/components/shared/CrawlerPilotsStandIn.tsx` | Cycle-2 only |
| `src/components/shared/SoftWarning*.tsx` | Cycle-3 only |
| `src/components/shared/useSoftWarnings.ts` | Cycle-3 only |
| `src/routeTree.gen.ts` | Auto-generated by all cycles that touch routes/ — expected merge conflict at integrate, resolved by re-running build (same as Wave 3) |

## Aggregate budget allocation

- 3 cycles planned, ≤7 remediation slots (budget 10)
- pr_strategy: one — single PR collecting all three cycles
- Mode: concurrent at 3-way (Wave 3's 4-way had higher stall rate)

## Testing discipline (carry-over from Wave 3)

- NO `mock.module()` in any test — it leaks globally across the Bun test process. Use dep-injection (cycle-2's wiring hooks should accept injectable entityStore; cycle-3's useSoftWarnings should accept injectable evaluateSoftWarnings).
- Test files MUST import `'@testing-library/jest-dom'` if they use DOM matchers (`toBeInTheDocument`, `toBeDisabled`, etc.).
- Commit the cycle-N.md completion record alongside the implementation — Wave 3's salvages came in part from workers forgetting this.
