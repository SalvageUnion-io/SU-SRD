# Plan — itun-revamp-wave-5

Three cycles, file-disjoint by directory. All branch from
`run/2026-05-18-itun-revamp-wave-5/work` @ TBD-SHA.

## Cycle-1 (Track A): Sheet view — read-only render for 4 modes (#198)

- **ACs covered**: AC-1, AC-2
- **Issue**: #198
- **Branch**: `run/2026-05-18-itun-revamp-wave-5/cycle-1`
- **Reads from**: entityStore (Wave 2), useSoftLinks (Wave 4), ConditionToggle (Wave 3), PilotStandIn + CrawlerPilotsStandIn (Wave 4)
- **File paths (owned)**:
  - `apps/in-the-union-now/src/routes/sheet/$kind/$id.tsx` — parameterized sheet route
  - `apps/in-the-union-now/src/components/sheet/Sheet.tsx` — root sheet component, resolves composition mode
  - `apps/in-the-union-now/src/components/sheet/PilotSheet.tsx` — pilot section
  - `apps/in-the-union-now/src/components/sheet/MechSheet.tsx` — mech section (HP/AP/TP/SP/EP/Heat displayed; click-to-edit deferred)
  - `apps/in-the-union-now/src/components/sheet/CrawlerSheet.tsx` — crawler section
  - `apps/in-the-union-now/src/components/sheet/SheetHeader.tsx` — name + composition mode header
  - `apps/in-the-union-now/src/components/sheet/__tests__/*.test.tsx` — render tests for all 4 modes + stand-in cases

## Cycle-2 (Track B): Snapshot backend ADR + endpoints (#202 + #203 + #204)

- **ACs covered**: AC-3, AC-4, AC-5
- **Issues**: #202 (ADR), #203 (publish), #204 (retrieve)
- **Branch**: `run/2026-05-18-itun-revamp-wave-5/cycle-2`
- **Reads from**: nothing app-internal; introduces new backend scaffold
- **File paths (owned)**:
  - `docs/adrs/ADR-NNN-snapshot-backend.md` — pick NNN by checking the existing docs/adrs/ directory
  - `apps/in-the-union-now/netlify/functions/snapshot-publish.ts` (or equivalent serverless layout)
  - `apps/in-the-union-now/netlify/functions/snapshot-retrieve.ts`
  - `apps/in-the-union-now/netlify/functions/__tests__/*.test.ts` — handler-level tests with mocked storage
  - `apps/in-the-union-now/src/lib/snapshot/client.ts` — client-side wrapper for the endpoints (optional but useful for cycle-1 if shared types are needed)
  - `apps/in-the-union-now/netlify.toml` or similar config (if needed; minimal)
  - `apps/in-the-union-now/package.json` — if a backend dep is needed (e.g., `@netlify/blobs`); cycle-2 owns the lockfile delta

## Cycle-3 (Track C): Wave 4 deferred wire-ins + hygiene

- **ACs covered**: AC-6 (partial — knip hygiene)
- **Issues**: no dedicated issue (wires up Wave 4 components)
- **Branch**: `run/2026-05-18-itun-revamp-wave-5/cycle-3`
- **Reads from**: SoftWarningBanner + useSoftWarnings + Assign*/Unassign* (Wave 4); entityStore (Wave 2)
- **File paths (owned)**:
  - `apps/in-the-union-now/src/routes/mechs/$id.tsx` — NEW minimal mech detail view (renders name + chassis summary + AssignPilotToMech + UnassignLinkButton + link to sheet)
  - `apps/in-the-union-now/src/routes/pilots/$id.tsx` — NEW pilot detail view (similar)
  - `apps/in-the-union-now/src/routes/crawlers/$id.tsx` — NEW crawler detail view
  - `apps/in-the-union-now/src/components/dashboard/EntityListItem.tsx` — small addition: link each row to /<kind>/<id> detail route and /sheet/<kind>/<id> sheet route
  - `apps/in-the-union-now/src/components/mech/MechBuilder.tsx` — small addition: SoftWarningBanner integration on the submit row (3-5 lines)
  - `apps/in-the-union-now/src/components/pilot/PilotWizard.tsx` — small addition: SoftWarningBanner on the review step (3-5 lines)
  - `knip.json` — remove the dead `src/lib/sw/__mocks__/**` ignore (Wave 2 carry-over)

## Dep graph

```
cycle-1 (Sheet view)         [no deps on cycle-2/3]
cycle-2 (Snapshot backend)   [no deps on cycle-1/3]
cycle-3 (Wire-ins + hygiene) [no deps on cycle-1/2 — touches different files]
```

All three dispatch in a single parallel batch.

## File-overlap analysis

| Path | Owner |
|------|-------|
| `src/routes/sheet/**` | Cycle-1 only |
| `src/components/sheet/**` | Cycle-1 only |
| `docs/adrs/ADR-NNN-snapshot-backend.md` | Cycle-2 only |
| `apps/in-the-union-now/netlify/**` | Cycle-2 only |
| `src/lib/snapshot/**` | Cycle-2 only |
| `apps/in-the-union-now/package.json` + `bun.lock` | Cycle-2 only (only if backend deps added) |
| `src/routes/{mechs,pilots,crawlers}/$id.tsx` | Cycle-3 only |
| `src/components/dashboard/EntityListItem.tsx` | Cycle-3 only |
| `src/components/mech/MechBuilder.tsx` | Cycle-3 only (1-line SoftWarningBanner add) |
| `src/components/pilot/PilotWizard.tsx` | Cycle-3 only (1-line SoftWarningBanner add) |
| `knip.json` | Cycle-3 only |
| `src/routeTree.gen.ts` | Auto-regen; expect merge conflict at integrate (cycle-1 + cycle-3 both add routes); resolved by re-running build |

## Aggregate budget allocation

- 3 cycles planned, ≤7 remediation slots (budget 10)
- pr_strategy: one
- Mode: concurrent at 3-way (same as Wave 4 — no stalls observed)

## Testing discipline

- NO `mock.module()` — dep-injection only
- `toBeTruthy()` not `toBeInTheDocument()` (Wave 4 workaround until jest-dom types are properly wired)
- Cycle-2's endpoint tests mock the storage layer (no live network); deployment + e2e is later wave
