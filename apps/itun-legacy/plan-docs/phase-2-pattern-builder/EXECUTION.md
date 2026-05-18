# Phase 2: Pattern Builder + CRUD — Execution Document

## Status: Complete (pending QA) + Post-Phase-2 Enhancements

## Overview

Phase 2 builds the first interactive feature for ITUN — a Pattern Builder that lets users design abstract mech loadouts (chassis + systems + modules) constrained by slot limits, with full CRUD and a dashboard library view.

---

## Task Tracker

| #   | Task                              | Status | Notes                                                |
| --- | --------------------------------- | ------ | ---------------------------------------------------- |
| 1   | Pattern types + validation        | Done   | `common.ts`, `validation.ts`                         |
| 2   | Pattern API layer                 | Done   | `patternApi.ts`                                      |
| 3   | TanStack Query hooks              | Done   | `usePatterns.ts`                                     |
| 4   | Builder utilities                 | Done   | `builderUtils.ts` + 35 unit tests                    |
| 5   | EntitySelectionModal              | Done   | Rich entity browser with filters + capacity split    |
| 6   | MechBuilder + DeletePatternDialog | Done   | Visual revamp with floating image, capacity-aware    |
| 7   | Pattern routes (new + edit)       | Done   | `/patterns/new`, `/patterns/$patternId`              |
| 8   | Dashboard integration             | Done   | `PatternSection` replaces static placeholder         |
| 9   | Entity selection utilities        | Done   | `entitySelectionUtils.ts` + 32 unit tests            |
| 10  | Regression test suite             | Done   | 62 tests, 551 assertions across 2 files              |
| 11  | Pattern visibility + read-only    | Done   | RLS policy, `patternAccess` utility, `readOnly` prop |
| 12  | Phase 2 DRY cleanup               | Done   | Audit-driven refactor (see below)                    |
| 13  | Footer button reorganization      | Done   | Delete/Cancel swap, Copy, unified pill styling       |
| 14  | Apply Reference Pattern           | Done   | Modal + referencePatternToItems + integration tests  |
| 15  | Salvage Value always visible      | Done   | Always in header; Starting Mech mode adds budget cap |

## Verification

| Check                          | Result                                             |
| ------------------------------ | -------------------------------------------------- |
| `bun run typecheck` (monorepo) | Pass (0 new errors)                                |
| `bun test` (ITUN)              | 112 tests, 800 assertions across 3 files           |
| Route tree generation          | `/patterns/new`, `/patterns/$patternId` registered |
| Manual QA                      | Pending                                            |

---

## Files

### New (19)

| File                                                | Purpose                                                                                                                                                                                                   |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/api/patternApi.ts`                         | Supabase CRUD: list, getById, create, update, delete                                                                                                                                                      |
| `src/hooks/usePatterns.ts`                          | TanStack Query hooks + key factory + mutations                                                                                                                                                            |
| `src/lib/builderUtils.ts`                           | Pure functions: resolvePatternItems, computeCapacity, computeSalvageValue, nextSortOrder, builderToCreateInput, patternToBuilderState, applyPatternItems, referencePatternToItems, patternItemsToOverride |
| `src/lib/builderUtils.test.ts`                      | 68 unit + integration tests for builder utilities (capacity, salvage value, sorting, serialization, apply pattern pipeline, round-trips)                                                                  |
| `src/lib/entitySelectionUtils.ts`                   | Pure filter/sort/split logic + shared types (`TechLevelValue`, `ALL_TECH_LEVELS`)                                                                                                                         |
| `src/lib/entitySelectionUtils.test.ts`              | 32 unit tests for entity selection (search, tech level, source, capacity splitting)                                                                                                                       |
| `src/lib/patternAccess.ts`                          | Pure `getPatternAccess()` — ownership-aware view/edit access logic                                                                                                                                        |
| `src/lib/patternAccess.test.ts`                     | 12 tests for access control (owner/non-owner/anonymous, readOnly rendering decisions)                                                                                                                     |
| `src/components/patterns/EntitySelectionModal.tsx`  | Rich entity browser: search, tech level/source filters, capacity-aware display                                                                                                                            |
| `src/components/patterns/MechBuilder.tsx`           | Builder card with floating chassis image, capacity bars, readOnly mode, apply pattern                                                                                                                     |
| `src/components/patterns/PatternSelectionModal.tsx` | Modal showing reference data patterns for a chassis, using EntityDisplay with patternOverride                                                                                                             |
| `src/components/patterns/DeletePatternDialog.tsx`   | Confirmation dialog for pattern deletion                                                                                                                                                                  |
| `src/components/patterns/EmptySlotCard.tsx`         | Shared dashed-border "add" affordance (used by MechBuilder + PatternSection)                                                                                                                              |
| `src/components/patterns/PatternSection.tsx`        | Dashboard section with loading/empty/populated states                                                                                                                                                     |
| `src/routes/_authenticated/patterns/new.tsx`        | Create pattern page                                                                                                                                                                                       |
| `src/routes/_authenticated/patterns/$patternId.tsx` | View (read-only) / edit / delete pattern page                                                                                                                                                             |
| `docs/PHASE2-EXECUTION.md`                          | This document                                                                                                                                                                                             |

**Deleted:**

- `src/components/patterns/PatternCard.tsx` — functionality absorbed by `PatternSection` using `EntityDisplay`

### Modified (5)

| File                                    | Change                                                                     |
| --------------------------------------- | -------------------------------------------------------------------------- |
| `src/types/common.ts`                   | Added PatternItem, CreatePatternInput, UpdatePatternInput, TypedPatternRow |
| `src/types/database-generated.types.ts` | Regenerated after `patterns` table + enums added to Supabase               |
| `src/lib/validation.ts`                 | Added patternItemSchema, createPatternSchema                               |
| `src/routes/_authenticated/index.tsx`   | Replaced static Patterns placeholder with PatternSection                   |
| `package.json`                          | Enabled `bun test` (was no-op echo)                                        |

### Modified in suref-react (shared components)

| File                                                | Change                                                                      |
| --------------------------------------------------- | --------------------------------------------------------------------------- |
| `EntityDisplay/EntityRightHeaderContent.tsx`        | Added `onAdd` prop with green `+` button (Plus icon from lucide-react)      |
| `EntityDisplay/components/EntityDisplayContent.tsx` | Thread `onAdd` through; renamed `onClick` → `onOpen`                        |
| `EntityDisplay/index.tsx`                           | Added `onAdd`, renamed `onClick` → `onOpen`                                 |
| `shared/FilterChip.tsx` (new)                       | Reusable filter toggle chip component                                       |
| `shared/techLevelStyles.ts` (new)                   | Tech level color map + label helper (`techLevelLabel`, `TECH_LEVEL_STYLES`) |
| `index.ts`                                          | Exported FilterChip, TECH_LEVEL_STYLES, techLevelLabel                      |

### Supabase Migrations

| Migration                                  | Purpose                                                 |
| ------------------------------------------ | ------------------------------------------------------- |
| `allow_select_own_or_public_mech_patterns` | SELECT policy: `auth.uid() = user_id OR visible = true` |

### Auto-generated (1)

| File                   | Trigger                                          |
| ---------------------- | ------------------------------------------------ |
| `src/routeTree.gen.ts` | TanStack Router plugin picked up new route files |

---

## Post-Phase-2 Visual Revamp

After the initial Phase 2 commit (`a438304`), the EntitySelectionModal and MechBuilder underwent a visual revamp across commits `25dc180` and `b117807`.

### EntitySelectionModal Revamp

The modal was rewritten from a simple `DisplayCard mode="listing"` approach to a rich entity browser:

**Architecture:**

- Replaced ShadCN `DialogContent` with raw Radix `DialogPrimitive` + `DisplayCard` wrapper for proper visual containment (non-transparent, bg-su-orange header)
- Filtering logic extracted to pure `filterAndSplitEntities()` in `entitySelectionUtils.ts` for testability
- Each entity rendered as `EntityDisplay compact` with `onAdd` callback (green `+` button in header)

**Features added:**

- **Tech level filter chips**: Toggle TL1–6, Bio, NPC via `FilterChip` components (from suref-react). "All" toggle button. Colors from suref-react theme.
- **Source filter chips**: Toggle by source book. "Salvage Union Workshop Manual" always listed first.
- **Capacity-aware splitting**: When `remainingSlots` is provided, entities with `slotsRequired > remainingSlots` are sorted to bottom as greyed-out, non-interactive cards with red outline (`opacity-50 pointer-events-none ring-2 ring-su-rust/50`)
- **Search**: Case-insensitive name filtering with trimmed whitespace
- **Alphabetical sorting**: Both selectable and over-capacity groups sorted by name
- **Visual polish**: Black outlines on entity cards (`ring-1 ring-su-black`), stable scrollbar gutter, proper padding for outline visibility

**Props:**

```typescript
type EntitySelectionModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  schemaName: BuilderSchemaName // exported type: 'chassis' | 'systems' | 'modules'
  onSelect: (entityId: string) => void
  filter?: (entity: { id: string; name: string }) => boolean
  remainingSlots?: number
}
```

### MechBuilder Updates

- Passes `remainingSlots` to EntitySelectionModal based on modal target type:
  - Systems: `capacity.systemSlotsTotal - capacity.systemSlotsUsed`
  - Modules: `capacity.moduleSlotsTotal - capacity.moduleSlotsUsed`
  - Chassis: `undefined` (no capacity concept)
- Added `md:mb-4` gap below floating chassis image
- `readOnly` prop hides all editing affordances (name input, change/add buttons, footer, image overlay, entity selection modal)

### onAdd Prop (suref-react)

New `onAdd?: () => void` prop threaded through EntityDisplay hierarchy:

```
EntityDisplay (onAdd prop)
  → EntityDisplayContent (pass unconditionally — not gated on listing mode)
    → EntityRightHeaderContent (render green + button when present)
```

Key design decision: `onAdd` passes through unconditionally (unlike `onDelete` which is gated on `listing` mode) because the selection modal uses compact non-listing mode.

Button styling: `bg-su-green` default, `hover:bg-emerald-600` on hover.

### onClick → onOpen rename (suref-react)

The `onClick` prop on `EntityDisplay` was renamed to `onOpen` for clarity — it overrides the default "open detail modal" behavior in listing mode, not a generic click handler.

---

## Pattern Visibility + Read-Only Mode

### RLS Policy

SELECT policy on `mech_patterns` updated to allow viewing public patterns:

```sql
USING (auth.uid() = user_id OR visible = true)
```

INSERT/UPDATE/DELETE remain owner-only (unchanged).

### Access Logic (`patternAccess.ts`)

Pure function `getPatternAccess(pattern, userId)` returns a discriminated union:

- `user_id === userId` → `{ canView: true, canEdit: true }` (owner)
- `visible && user_id !== userId` → `{ canView: true, canEdit: false }` (read-only viewer)
- `!visible && user_id !== userId` → `{ canView: false }` (hidden)

### Route Behavior (`$patternId.tsx`)

- `canView: false` or error → "Pattern not found" (same UX)
- `canView: true, canEdit: false` → MechBuilder with `readOnly` (no save/delete/add/remove)
- `canView: true, canEdit: true` → full edit mode with delete button

---

## Phase 2 DRY Cleanup

Audit-driven refactor addressing 13 findings:

### Extractions

- **`patternToBuilderState`** moved from route file to `builderUtils.ts` + 4 tests (including round-trip with `builderToCreateInput`)
- **`TechLevelValue` + `ALL_TECH_LEVELS`** consolidated into `entitySelectionUtils.ts` (single source of truth)
- **`BuilderSchemaName`** type exported from `EntitySelectionModal`, `ModalTarget` in MechBuilder defined as `BuilderSchemaName | null`
- **`EmptySlotCard`** extracted to shared file with `EMPTY_SLOT_CLASSES` constant (used by MechBuilder + PatternSection)
- **`ItemSlotSection`** extracted in MechBuilder — deduplicates identical Systems/Modules section rendering
- **Tag button styling** consolidated into `TAG_BUTTON` / `TAG_BUTTON_SM` / `TAG_BUTTON_SM_DANGER` constants
- **`getEntityName` / `getEntityId`** helpers extracted in `entitySelectionUtils.ts` and `EntitySelectionModal.tsx`

### Removals

- `RemovableEntityCard` trivial wrapper inlined (was just `EntityDisplay` with prop rename)
- Unused `scrapBudget` / `techLevelFilter` "Phase 3" props removed from `MechBuilderProps`
- `PatternCard.tsx` deleted (functionality absorbed by EntityDisplay in PatternSection)

### Consistency

- Error callback param standardized to `error` (was `err` in `$patternId.tsx`)
- Duplicated "Pattern not found" JSX block collapsed into single guard

---

## Post-Phase-2 Enhancements

### Footer Button Reorganization

The MechBuilder footer was reorganized for clearer editing affordances:

- **Delete replaces Cancel** on edit screens (`onDelete` present → red pill button; absent → outline Cancel)
- **Copy button** added between Delete and Save (green pill, `onCopy` prop). Creates `"Copy of <name>"` pattern via `useCreatePattern`, navigates to the copy.
- **Unified pill styling** across all action buttons: `rounded-md font-mono uppercase` with `cursor-pointer`. Colors: Delete=`bg-su-rust`, Copy=`bg-su-green`, Save=`bg-su-orange`.
- **Visibility toggle** and **Starting Mech mode** toggle on left side of footer.

### Apply Reference Pattern

"Apply Pattern" button appears next to "Change" in the chassis header. Opens a `PatternSelectionModal` showing all reference data patterns for the current chassis (from `salvageunion-reference`, not user-created Supabase patterns).

**Architecture:**

- `PatternSelectionModal` uses `SalvageUnionReference.Chassis.find()` to get `chassis.patterns`
- Each pattern rendered as `EntityDisplay compact hideStats hidePatterns` with `patternOverride` (shows pattern-specific name, systems, modules, chassis abilities)
- Green `+` button (via `onAdd`) selects the pattern and closes the modal
- Modal uses Radix `DialogPrimitive` + `DisplayCard` (same pattern as EntitySelectionModal)

**Data flow:**

1. User clicks "Apply Pattern" → modal opens
2. User selects a reference pattern → `onSelect(pattern: SURefObjectPattern)` fires
3. `referencePatternToItems(pattern.systems, pattern.modules)` converts name-based references to ID-based `PatternItem[]`
4. `applyPatternItems(state, items)` replaces all builder items
5. Pattern name is also applied to the builder state

**Key functions:**

- `referencePatternToItems()` — converts `{ name, count? }[]` systems/modules to `PatternItem[]` by resolving names to entity IDs via `SalvageUnionReference.Systems.find()` / `Modules.find()`. Expands `count` into individual items. Skips unresolvable names.
- `applyPatternItems()` — replaces all items, re-indexes sort_order from 0, preserves all other state (chassisRef, description, visible, customImageUrl)

### Salvage Value Always Visible

The Salvage Value stat is now always shown in the MechBuilder header, displaying the total cost of chassis + items. When Starting Mech mode is toggled on, it additionally shows the `/20` budget cap and over-budget red highlighting.

### Cleanup

- Removed `listPatternsByChassis` from `patternApi.ts` (unused after modal switched to reference data)
- Removed `usePatternsByChassis` hook and `byChassis` query key from `usePatterns.ts`
- Removed `onEdit` prop from `PatternSection` dashboard listings (redundant with `onOpen`)

---

## Test Coverage

### builderUtils.test.ts (68 tests)

| Suite                                  | Tests | Coverage                                                                                                                                                                                                            |
| -------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `computeCapacity`                      | 9     | Null/undefined chassis, system/module counting, over-capacity detection (single + simultaneous), exact capacity boundary, empty items, real chassis data                                                            |
| `computeSalvageValue`                  | 9     | Null/undefined chassis, chassis+items cost sum, budget boundary (exact/over), items-only, remainingBudget math, real game data integration, STARTING_MECH_BUDGET constant                                           |
| `nextSortOrder`                        | 4     | Empty array, max+1 logic, single item, non-contiguous orders                                                                                                                                                        |
| `builderToCreateInput`                 | 9     | Empty/whitespace name, null chassis, valid state, name trimming, empty/whitespace description, visible=false, empty items, multiple items, customImageUrl excluded                                                  |
| `resolvePatternItems`                  | 7     | Empty array, valid system/module, non-existent IDs, mixed valid/invalid, sort_order preservation, slotsRequired property, multiple systems + modules                                                                |
| `computeCapacity with real game data`  | 2     | Real chassis + real systems integration, overloading triggers invalid                                                                                                                                               |
| `patternToBuilderState`                | 4     | Basic conversion, null description, customImageUrl always null, round-trip with builderToCreateInput                                                                                                                |
| `applyPatternItems`                    | 5     | Replace all items, re-index sort_order, preserve non-item state, empty pattern clears, immutability                                                                                                                 |
| `patternItemsToOverride`               | 7     | Empty items, real system/module resolution, duplicate grouping with count, single items without count, non-existent IDs skipped, system/module separation                                                           |
| `referencePatternToItems`              | 9     | Empty input, single system/module by name, count expansion, non-existent name skip, systems-before-modules ordering, real Hauler Pattern integration, default count equivalence                                     |
| `Apply Pattern pipeline (integration)` | 4     | Full Hauler Pattern pipeline (convert → apply → resolve → capacity), sequential pattern replacement, round-trip name reconstruction via patternItemsToOverride, all chassis patterns produce valid resolvable items |

### entitySelectionUtils.test.ts (32 tests)

| Suite                               | Tests | Coverage                                                                                                                                                 |
| ----------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search filtering`                  | 5     | Empty search, name matching (case-insensitive), whitespace trimming, no-match returns empty, case variants                                               |
| `tech level filtering`              | 5     | Single TL, multiple TLs, empty set → no results, all TLs → all entities, Bio filter                                                                      |
| `source filtering`                  | 3     | Empty set (no filtering), single source, multiple sources                                                                                                |
| `external filter prop`              | 2     | External filter function, combined with search                                                                                                           |
| `alphabetical sorting`              | 2     | Selectable sorted, over-capacity sorted                                                                                                                  |
| `capacity splitting`                | 6     | No splitting when undefined, split by slot capacity, total count invariant, remainingSlots=0, high slots → all selectable, chassis without slotsRequired |
| `combined filters`                  | 2     | Search + tech level + capacity, search + source filter                                                                                                   |
| `works with different entity types` | 3     | Modules, chassis, module capacity splitting                                                                                                              |

### patternAccess.test.ts (12 tests)

| Suite                          | Tests | Coverage                                                                                                                                                               |
| ------------------------------ | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getPatternAccess`             | 6     | Owner private/public, non-owner public/private, undefined userId private/public                                                                                        |
| `readOnly rendering decisions` | 6     | Owner always editable, non-owner public=readOnly, non-owner private=hidden, anonymous public=readOnly, anonymous private=hidden, canEdit never true when canView false |

---

## Design Decisions

### Deviations from Architecture Doc (carried forward from plan)

1. **No `src/types/pattern.ts`** — pattern types live in `common.ts` alongside existing DB row aliases. One source of truth.
2. **EntitySelectionModal uses full EntityDisplay compact** — not listing mode. Each entity is a rich card with stats, actions, and description. The `onAdd` prop provides a green `+` button as the selection mechanism.
3. **Chassis change does NOT auto-clear items** — if the new chassis has fewer slots, items remain but save is disabled until the user resolves over-capacity. Avoids silent data loss.
4. **MechBuilder is a pure component** — no page-level concerns (title, delete button). Routes handle page chrome.

### Implementation-time decisions

5. **Radix DialogPrimitive over ShadCN Dialog** — ShadCN's `DialogContent` rendered with transparent backgrounds and positioning issues in the context of DisplayCard wrapping. Raw Radix primitives give full control over overlay, positioning, and visual containment.
6. **`pattern_items` serialized via `JSON.parse(JSON.stringify())` for Supabase insert/update** — Supabase's `Json` type is strict. Round-tripping through JSON satisfies the type checker and guarantees clean serialization.
7. **FilterChip + techLevelStyles added to suref-react** — shared for reuse across both suref-web schema viewer and ITUN entity selection modal.
8. **Entity selection filtering extracted to pure utility** — `filterAndSplitEntities()` extracted from React hooks into `entitySelectionUtils.ts` for unit testing without React rendering overhead.
9. **`onAdd` passes through unconditionally** — unlike `onDelete` (gated on `listing` mode), `onAdd` is always forwarded because the modal uses compact (non-listing) mode.
10. **`onClick` renamed to `onOpen`** — clarifies intent: overrides the "open detail modal" behavior, not a generic click handler.
11. **Apply Pattern uses reference data, not Supabase** — "Apply Pattern" modal shows game reference patterns from `salvageunion-reference` (chassis.patterns), not user-created patterns stored in Supabase. This is a builder affordance for populating a new design from a known-good template.
12. **Apply Pattern sets builder name** — when applying a reference pattern, the builder name is updated to the pattern name (e.g., "Hauler Pattern") so the user starts with a meaningful name they can customize.
13. **Delete replaces Cancel contextually** — edit screens show Delete (pattern already exists), new screens show Cancel (nothing to delete). Avoids cluttering the footer with both buttons simultaneously.

---

## Manual QA Checklist

- [ ] Dashboard shows empty pattern section with "New Pattern" slot
- [ ] `/patterns/new` renders MechBuilder (no page header)
- [ ] Can select a chassis via modal, search works
- [ ] Can add systems and modules, slot counts update
- [ ] Save disabled when name empty, no chassis, or over capacity
- [ ] Save creates DB row, redirects to dashboard
- [ ] Dashboard shows saved pattern card with chassis name
- [ ] Click card navigates to `/patterns/$patternId`
- [ ] Edit page loads pattern data into builder
- [ ] Can update name, chassis, items; save persists changes
- [ ] Delete button shows confirmation, deletes pattern, redirects to dashboard
- [ ] Over-capacity state: add items beyond slot limits, save button disabled
- [ ] Changing chassis to one with fewer slots shows over-capacity, doesn't clear items
- [ ] EntitySelectionModal: tech level filter chips toggle correctly
- [ ] EntitySelectionModal: source filter chips toggle correctly, Workshop Manual first
- [ ] EntitySelectionModal: over-capacity items greyed out at bottom with red outline
- [ ] EntitySelectionModal: search filters by name, case-insensitive
- [ ] EntitySelectionModal: green + button selects entity and closes modal
- [ ] EntitySelectionModal: remaining slots shown in subtitle
- [ ] Own private pattern → full edit with delete button
- [ ] Own public pattern → full edit with delete button
- [ ] Other's public pattern → read-only (no save/delete/add/remove)
- [ ] Other's private pattern → "Pattern not found"
- [ ] Edit screen footer: Delete (red), Copy (green), Save (orange) — unified pill styling
- [ ] New screen footer: Cancel (outline), Save (orange) — no Delete or Copy
- [ ] Copy button creates "Copy of <name>" pattern and navigates to it
- [ ] Apply Pattern button visible next to "Change" in chassis header
- [ ] Apply Pattern modal shows all reference patterns for the current chassis
- [ ] Each pattern in modal shows systems, modules, chassis abilities, and pattern name
- [ ] Selecting a pattern replaces all builder items and sets pattern name
- [ ] Salvage Value stat always visible in header
- [ ] Starting Mech mode toggle adds /20 budget cap and over-budget highlighting to Salvage Value

---

## Known Issues / Follow-ups

- None yet. Update this section as issues surface during QA.
