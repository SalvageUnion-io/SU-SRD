# Phase 2: Pattern Builder + CRUD — Execution Document

## Status: Complete (pending QA)

## Overview

Phase 2 builds the first interactive feature for ITUN — a Pattern Builder that lets users design abstract mech loadouts (chassis + systems + modules) constrained by slot limits, with full CRUD and a dashboard library view.

---

## Task Tracker

| #   | Task                              | Status | Notes                                              |
| --- | --------------------------------- | ------ | -------------------------------------------------- |
| 1   | Pattern types + validation        | Done   | `common.ts`, `validation.ts`                       |
| 2   | Pattern API layer                 | Done   | `patternApi.ts`                                    |
| 3   | TanStack Query hooks              | Done   | `usePatterns.ts`                                   |
| 4   | Builder utilities                 | Done   | `builderUtils.ts` + 10 unit tests                  |
| 5   | EntitySelectionModal              | Done   | Normalized `ListEntity` type to avoid union issues |
| 6   | MechBuilder + DeletePatternDialog | Done   | Pure component, no page-level concerns             |
| 7   | Pattern routes (new + edit)       | Done   | `/patterns/new`, `/patterns/$patternId`            |
| 8   | Dashboard integration             | Done   | `PatternSection` replaces static placeholder       |

## Verification

| Check                          | Result                                             |
| ------------------------------ | -------------------------------------------------- |
| `bun run typecheck` (monorepo) | Pass                                               |
| `bun test` (ITUN)              | 10/10 pass, 22 assertions                          |
| Route tree generation          | `/patterns/new`, `/patterns/$patternId` registered |
| Manual QA                      | Pending                                            |

---

## Files

### New (11)

| File                                                | Purpose                                                                                   |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/lib/api/patternApi.ts`                         | Supabase CRUD: list, getById, create, update, delete                                      |
| `src/hooks/usePatterns.ts`                          | TanStack Query hooks + key factory + mutations                                            |
| `src/lib/builderUtils.ts`                           | Pure functions: resolvePatternItems, computeCapacity, nextSortOrder, builderToCreateInput |
| `src/lib/builderUtils.test.ts`                      | Unit tests for builder utilities                                                          |
| `src/components/patterns/EntitySelectionModal.tsx`  | Search + select dialog for chassis/systems/modules                                        |
| `src/components/patterns/MechBuilder.tsx`           | Builder card with chassis, systems, modules sections                                      |
| `src/components/patterns/DeletePatternDialog.tsx`   | Confirmation dialog for pattern deletion                                                  |
| `src/components/patterns/PatternCard.tsx`           | Compact card for dashboard grid display                                                   |
| `src/components/patterns/PatternSection.tsx`        | Dashboard section with loading/empty/populated states                                     |
| `src/routes/_authenticated/patterns/new.tsx`        | Create pattern page                                                                       |
| `src/routes/_authenticated/patterns/$patternId.tsx` | Edit + delete pattern page                                                                |

### Modified (5)

| File                                    | Change                                                                     |
| --------------------------------------- | -------------------------------------------------------------------------- |
| `src/types/common.ts`                   | Added PatternItem, CreatePatternInput, UpdatePatternInput, TypedPatternRow |
| `src/types/database-generated.types.ts` | Regenerated after `patterns` table + enums added to Supabase               |
| `src/lib/validation.ts`                 | Added patternItemSchema, createPatternSchema                               |
| `src/routes/_authenticated/index.tsx`   | Replaced static Patterns placeholder with PatternSection                   |
| `package.json`                          | Enabled `bun test` (was no-op echo)                                        |

### Auto-generated (1)

| File                   | Trigger                                          |
| ---------------------- | ------------------------------------------------ |
| `src/routeTree.gen.ts` | TanStack Router plugin picked up new route files |

---

## Design Decisions

### Deviations from Architecture Doc (carried forward from plan)

1. **No `src/types/pattern.ts`** — pattern types live in `common.ts` alongside existing DB row aliases. One source of truth.
2. **EntitySelectionModal uses `DisplayCard mode="listing"` directly** — not `EntityDisplay`, because we need click-to-select behavior, not click-to-detail.
3. **Chassis change does NOT auto-clear items** — if the new chassis has fewer slots, items remain but save is disabled until the user resolves over-capacity. Avoids silent data loss.
4. **MechBuilder is a pure component** — no page-level concerns (title, delete button). Routes handle page chrome.

### Implementation-time decisions

5. **Normalized `ListEntity` type in EntitySelectionModal** — `getEntities()` returns a union of Chassis/System/Module arrays. Rather than fight TypeScript's union narrowing through `.filter()`, we project into a flat `ListEntity` shape. Simpler, no type gymnastics.
6. **`pattern_items` serialized via `JSON.parse(JSON.stringify())` for Supabase insert/update** — Supabase's `Json` type is strict. Round-tripping through JSON satisfies the type checker and guarantees clean serialization.
7. **`techLevel` and `salvageValue` treated as optional in EntitySelectionModal** — some chassis entities may not have these fields set; the stats display gracefully omits them.

---

## Manual QA Checklist

- [ ] Dashboard shows empty pattern section with "Create a Pattern" link
- [ ] `/patterns/new` renders MechBuilder
- [ ] Can select a chassis via modal, search works
- [ ] Can add systems and modules, slot counts update
- [ ] Save disabled when name empty, no chassis, or over capacity
- [ ] Save creates DB row, redirects to dashboard
- [ ] Dashboard shows saved pattern card with chassis name + counts
- [ ] Click card navigates to `/patterns/$patternId`
- [ ] Edit page loads pattern data into builder
- [ ] Can update name, chassis, items; save persists changes
- [ ] Delete button shows confirmation, deletes pattern, redirects to dashboard
- [ ] Over-capacity state: add items beyond slot limits, save button disabled
- [ ] Changing chassis to one with fewer slots shows over-capacity, doesn't clear items

---

## Known Issues / Follow-ups

- None yet. Update this section as issues surface during QA.
