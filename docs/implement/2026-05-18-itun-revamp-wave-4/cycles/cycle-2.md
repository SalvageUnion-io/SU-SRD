# Cycle-2 Record — Soft Wiring + Stand-In Components

**Run**: 2026-05-18-itun-revamp-wave-4  
**Branch**: run/2026-05-18-itun-revamp-wave-4/cycle-2  
**ACs covered**: AC-3 (#195), AC-4 (#194)  
**Status**: complete

## Summary

Implemented the soft wiring affordance layer (AC-3) and auto stand-in placeholder components (AC-4) for the ITUN revamp Wave 4.

Part 1 (AC-3) delivers a hook + three UI components for creating and removing SoftLink records:
- `useSoftLinks` hook with dep-injection for testability, Zustand subscription for production reactivity
- `AssignPilotToMech` component (mech → pilot link creation, with inline pilot selector dialog)
- `AssignCrawlerToPilot` component (pilot → crawler link creation, symmetric)
- `UnassignLinkButton` component (removes the SoftLink only — no entity cascade)

Part 2 (AC-4) delivers two dumb placeholder components:
- `PilotStandIn` — renders "No Pilot Assigned" with dashed border
- `CrawlerPilotsStandIn` — renders "No Pilots Assigned" with dashed border

Both stand-ins have zero entityStore access; callers determine when to render them.

## Files Touched

### New — wiring components
- `apps/in-the-union-now/src/components/wiring/useSoftLinks.ts`
- `apps/in-the-union-now/src/components/wiring/AssignPilotToMech.tsx`
- `apps/in-the-union-now/src/components/wiring/AssignCrawlerToPilot.tsx`
- `apps/in-the-union-now/src/components/wiring/UnassignLinkButton.tsx`
- `apps/in-the-union-now/src/components/wiring/__tests__/useSoftLinks.test.ts`
- `apps/in-the-union-now/src/components/wiring/__tests__/wiringComponents.test.tsx`

### New — stand-in components
- `apps/in-the-union-now/src/components/shared/PilotStandIn.tsx`
- `apps/in-the-union-now/src/components/shared/CrawlerPilotsStandIn.tsx`
- `apps/in-the-union-now/src/components/shared/__tests__/StandIns.test.tsx`

### New — cycle record
- `docs/implement/2026-05-18-itun-revamp-wave-4/cycles/cycle-2.md` (this file)

### Not touched (consumed read-only)
- `src/stores/entityStore.ts`, `src/lib/schemas/softLink.ts`, `src/lib/schemas/entity.ts`
- All mech/pilot/crawler/dashboard component files

## AC Coverage

### AC-3 (#195) — Soft wiring affordance
- `useSoftLinks` returns `{ outgoing, incoming, assign, unassign }` for any entity
- `assign(target)` calls `entityStore.create('softLink', { from, to, type })` with correct discriminant
- `unassign(linkId)` calls `entityStore.delete('softLink', id)` — no entity cascade
- `AssignPilotToMech`: mech detail slot for "Assign Pilot" button + dialog
- `AssignCrawlerToPilot`: pilot detail slot for "Assign Crawler" button + dialog
- `UnassignLinkButton`: removes only the link; copy explicitly states no entity deletion
- Orphan semantics confirmed: SoftLink survives after endpoint entity deleted (test: "orphan: after the target entity is removed...")

### AC-4 (#194) — Auto stand-in rendering
- `PilotStandIn`: renders "No Pilot Assigned", dashed border, muted text, accepts className
- `CrawlerPilotsStandIn`: renders "No Pilots Assigned", same visual treatment
- Both are intentionally dumb — zero entityStore imports; callers check SoftLinks before rendering

## Verification

```
bun test apps/in-the-union-now/src/components/wiring/__tests__/
bun test apps/in-the-union-now/src/components/shared/__tests__/
# 43 pass, 0 fail, 73 expect() calls across 4 files

bun --filter in-the-union-now typecheck
# 0 errors in cycle-2 owned files
# Pre-existing errors in salvageunion-reference-dependent files (unbuilt package on bootstrap commit)
```

## Notes on Wire-In Scope

Per plan, Part 3 "wire-in" is demonstrational only. The existing mech/pilot detail files
(`MechBuilder.tsx`, `PilotWizard.tsx`, etc.) were **not modified** in this cycle because:

1. The plan explicitly states: "DO NOT restructure existing builder/dashboard files."
2. The mech/pilot builders already have pre-existing type errors from the unbuilt `salvageunion-reference`
   package; touching those files would risk merge conflicts with cycle-1 (which adds Pattern routes
   and may touch the same builder context).

**Follow-up**: Wire `AssignPilotToMech` into a mech detail panel and `PilotStandIn` into the
mech sheet view in Wave 5 polish (or as a light PR on top of this one once all three cycles land).

## Testing Discipline

- No `mock.module()` used — all mocking via dep-injection through the `store` prop
- Wiring hook tests use `renderHook` to satisfy React hook rules
- Stand-in tests use `screen.getByText` / `screen.getByLabelText` (no DOM matchers that
  require `@testing-library/jest-dom` type augmentation, which isn't wired into `bun-types`)
- Pre-existing `toBeInTheDocument` type setup gap noted (no `@types/testing-library__jest-dom`
  in tsconfig `types` array) — runtime works but TS surface isn't augmented; did not fix (out of scope)
