# Phase 3: Pilot Builder + Mech Instantiation - Execution

## Summary

Phase 3 delivers the "build your character" flow: guided pilot creation that renders the "Create a Pilot" guide as an interactive wizard, a pilot detail page with inline mech creation/editing, and dashboard integration.

## Completed Work

### 1. DB Migration: `add_pilot_personal_info_and_cleanup_triggers`

Added personal info columns to `pilots` table:
- `background`, `background_used`, `motto`, `motto_used`, `keepsake`, `keepsake_used`, `appearance`

Created cascade cleanup triggers for `pilots`, `mechs`, and `crawlers` tables that delete associated `entity_refs`, `cargo`, and `player_choices` rows on parent deletion.

Follow-up migration `fix_cleanup_function_search_path` set `search_path = public` on the function to resolve a security advisory.

### 2. suref-react Exports

Exported from `packages/suref-react/src/index.ts`:
- `GuideStepsDisplay`, `BlockContentRendererView` (guide rendering)
- `getStepNumbers`, `matchesFilter`, `enrichForFiltering` (guide helpers)
- `borderColorFromHeaderBg` (entity display helpers)

### 3. Pure Utilities + Tests

**`src/lib/pilotUtils.ts`** - Wizard logic with no React/Supabase dependencies:
- `getDigitalSteps` - filters paperOnly steps
- `resolveStepEntities` - resolves entities per step with `contextFrom` filtering (abilities by class coreTrees)
- `rollD20`, `rollOnTable` - roll table resolution via `resultForTable`/`resultForColumnsTable`
- `validateStep` - step completion validation by stepType
- `canSubmitWizard` - all-steps validation
- `createWizardReducer` - useReducer factory handling SELECT_ENTITY (with dependent step reset), SET_TEXT, SET_ROLL, ADVANCE_STEP, GO_TO_STEP, RESET
- `wizardToCreateInput` - converts wizard state to `CreatePilotInput`

**`src/lib/mechUtils.ts`** - Mech stats and entity ref bridge:
- `computeMechStatsFromChassis`/`computeMechStatsFromRef` - SP/EP/Heat/Cargo from chassis
- `patternItemsToEntityRefs` - pattern items to entity_ref insert rows
- `abilityToEntityRef`/`equipmentToEntityRefs` - pilot entity_ref generation
- `entityRefsToBuilderState` - mech + entity_refs to BuilderState for MechBuilder reuse
- `builderStateToPatchOps` - diff old entity_refs vs new BuilderState for patch operations

**Tests:** 159 tests passing across `pilotUtils.test.ts` (~100 assertions) and `mechUtils.test.ts` (~30 assertions).

### 4. API Layer

**`src/lib/api/pilotApi.ts`:**
- `listPilots`, `getPilotById`, `createPilot` (inserts pilot + entity_refs for ability/equipment), `updatePilot`, `deletePilot`, `getPilotEntityRefs`

**`src/lib/api/mechApi.ts`:**
- `instantiateMechFromPattern` (inserts mech + entity_refs + links to pilot), `getMechById`, `getMechEntityRefs`, `updateMechEntityRefs`

### 5. TanStack Query Hooks

**`src/hooks/usePilots.ts`:** `pilotKeys` factory, `usePilots`, `usePilot`, `usePilotEntityRefs`, `useCreatePilot`, `useUpdatePilot`, `useDeletePilot`

**`src/hooks/useMechs.ts`:** `mechKeys` factory, `useMech`, `useMechEntityRefs`, `useInstantiateMech`, `useUpdateMechLoadout`

### 6. InteractiveGuideSteps Component

`src/components/pilots/InteractiveGuideSteps.tsx` - Renders a guide's steps with interactive behavior:
- Step locking: steps unlock progressively (step N requires step N-1 complete)
- `select-one`: EntityDisplay cards with green ring highlight on selection, replaces previous selection
- `select-many`: toggle on/off with count badge, enforces `constraints.max`
- `roll-table`: Roll button + freeform text input
- `info`: auto-completes
- Current step expanded, past steps collapsed with summary, future steps dimmed

### 7. Pilot Creation Route (`/pilots/new`)

Uses `InteractiveGuideSteps` to render the "Create a Pilot" guide as an interactive wizard. On submit, creates the pilot via `useCreatePilot` and navigates to the pilot detail page.

### 8. Pilot Detail Route (`/pilots/$pilotId`)

Hub page for a pilot character:
- **Header**: Class EntityDisplay with callsign label + HP/AP/TP stat badges
- **Personal Info**: Inline editable fields (background, motto, keepsake, appearance) with "used" toggle
- **Abilities + Equipment**: EntityDisplay compact listings from entity_refs
- **Mech**:
  - No mech: "Create Starting Mech" button opens MechBuilder inline
  - Has mech: MechBuilder with existing state, save applies diffs via `builderStateToPatchOps`
- **Delete**: Confirmation dialog with cascade cleanup

### 9. Dashboard Integration

**`src/components/pilots/PilotSection.tsx`:** Mirrors `PatternSection` - loading skeletons, pilot cards as EntityDisplay (class art + callsign), "New Pilot" slot.

**`src/routes/_authenticated/index.tsx`:** Added `PilotSection` above `PatternSection`, replaced placeholder "Pilots" section.

## Flow

1. Dashboard -> "New Pilot" -> `/pilots/new` (interactive guide wizard)
2. Complete wizard steps (class, ability, equipment, personal info) -> "Create Pilot"
3. Pilot saved to DB -> navigate to `/pilots/$pilotId`
4. Pilot detail page shows all info + "Create Starting Mech" button
5. Click "Create Starting Mech" -> Mech creation wizard appears (InteractiveGuideSteps with "Create a Mech" guide)
6. Select chassis -> systems/modules steps unlock with dynamic slot counts from chassis
7. Complete wizard -> mech instantiated and linked to pilot
8. After creation, MechBuilder appears for editing the mech's loadout

## Mech Creation Wizard + scalesWithField Support

Added after the initial Phase 3 implementation to replace MechBuilder-based creation with an InteractiveGuideSteps wizard.

### Dynamic Constraint Resolution

The "Create a Mech" guide has steps where `constraints.scalesWithField` specifies a field name (e.g., `systemSlots`, `moduleSlots`) on the selected chassis entity. This dynamically determines the max selection count.

**`resolveConstraintMax(step, state, steps)`** resolves the effective max:
1. Static `constraints.max` takes priority
2. `scalesWithField` + `contextFrom` → look up the parent entity's field value
3. Falls back to `Infinity`

`validateStep`, `canSubmitWizard`, and `createWizardReducer` all use `resolveConstraintMax` for dynamic enforcement. `InteractiveGuideSteps` displays the dynamic max in the count badge.

### Mech Wizard → API Conversion

**`mechWizardToInstantiateInput(state, steps)`** maps wizard state to `InstantiateMechInput`:
- Chassis step → `chassis_ref`
- Systems step → `pattern_items` with `schema_name: 'systems'`
- Modules step → `pattern_items` with `schema_name: 'modules'`
- Pattern Name step → `pattern_name`

### PilotMechSection Rewrite

- **No mech:** "Create Starting Mech" button → InteractiveGuideSteps wizard with "Create a Mech" guide
- **Has mech (unchanged):** MechBuilder with existing state for editing

## Always-On Budget Counter for Mech Wizard

Added a salvage value budget display to the mech creation wizard, enforcing the 20 TL1 scrap starting budget.

### Budget Chip on Step Headers

`InteractiveGuideSteps` now accepts an optional `WizardBudgetConfig`:
```ts
type WizardBudgetConfig = {
  budget: number          // Max budget (20)
  totalCost: number       // Current total cost of all selections
  remainingBudget: number // budget - totalCost
  budgetSchemas: Set<string> // Schema names participating (chassis, systems, modules)
}
```

The `renderStepHeaderExtra` callback renders a three-segment chip `SV|x/20|TL1` on steps 2/3/4 (chassis, systems, modules). The chip uses `Text` components with `pseudoheader` (white on black) for SV and TL1 segments, and `pseudoheaderInverse` (black on white) for the counter.

### Budget Chip Positioning

`GuideStepsDisplay` renders `renderStepHeaderExtra` on the "inside" of each step:
- **Odd-numbered steps** (left-aligned): chip renders AFTER the step name (right side = inside)
- **Even-numbered steps** (right-aligned): chip renders BEFORE the step name (left side = inside)

### Budget-Based Entity Disabling

`resolveEntities` in `InteractiveGuideSteps` wraps the base entity list and marks entities as `disabled` when their salvage value exceeds the remaining budget. Already-selected entities are exempt from disabling.

### Budget Computation

`create-mech.tsx` computes `WizardBudgetConfig` from wizard state by summing salvage values of all selected chassis/systems/modules entities against `STARTING_MECH_BUDGET` (20).

### Optional Systems & Modules Steps

The "Craft your Systems" and "Craft your Modules" guide steps are now `optional: true` in `guides.json`. This means:
- The mech wizard is submittable with just a chassis + pattern name
- `validateStep` for optional steps: `canProceed` is always true; `isComplete` reflects whether valid selections exist
- Players can skip systems/modules entirely or fill some slots without filling all

### DisplayCard Disabled Behavior

Changed disabled styling from grey header replacement to opacity-based:
- **Before:** `disabled` swapped header bg to grey and stripped expansion source decorations
- **After:** `disabled` applies `opacity-50` on the outer wrapper while preserving the original header color, border, and source decorations (expansion fangs, etc.)

This ensures disabled entities retain their visual identity (class colors, expansion styling) and are merely dimmed.

### Selected Card Ring Removed

Removed the green `ring-2 ring-green-500 ring-offset-1` from `DisplayCard` when `selected` is true. The `selected` prop remains in the type but has no visual effect.

### SectionSeparator Children Prop

Added optional `children?: ReactNode` to `SectionSeparator` — renders between the label text and trailing separator line.

## File Summary

### New Files (14)
| File | Purpose |
|------|---------|
| `src/components/pilots/InteractiveGuideSteps.tsx` | Interactive guide step rendering with budget config + dynamic constraints |
| `src/components/pilots/PilotSection.tsx` | Dashboard pilot section |
| `src/lib/pilotUtils.ts` | Wizard logic, entity resolution, roll tables, constraint resolution |
| `src/lib/pilotUtils.test.ts` | Wizard tests (203 tests) |
| `src/lib/mechUtils.ts` | Mech stats, entity_ref conversion |
| `src/lib/mechUtils.test.ts` | Mech utility tests |
| `src/lib/api/pilotApi.ts` | Pilot CRUD + entity refs |
| `src/lib/api/mechApi.ts` | Mech instantiation + entity_ref editing |
| `src/hooks/usePilots.ts` | TanStack Query pilot hooks |
| `src/hooks/useMechs.ts` | TanStack Query mech hooks |
| `src/routes/_authenticated/pilots/new.tsx` | Pilot creation route |
| `src/routes/_authenticated/pilots/$pilotId.tsx` | Pilot detail/edit route |
| `src/routes/_authenticated/pilots/$pilotId/create-mech.tsx` | Mech creation wizard route with budget computation |
| `plan-docs/phase-3/EXECUTION.md` | This document |

### Modified Files (8)
| File | Change |
|------|--------|
| `packages/suref-react/src/index.ts` | Added guide system exports |
| `packages/suref-react/src/components/shared/DisplayCard.tsx` | Disabled styling: opacity instead of grey bg, removed selected ring |
| `packages/suref-react/src/components/entity/GuideStepsDisplay.tsx` | Added `renderStepHeaderExtra` to interactive config with inside-positioning |
| `packages/suref-react/src/components/entity/EntityDisplay/SectionSeparator.tsx` | Added `children` prop |
| `packages/salvageunion-reference/data/guides.json` | Systems/Modules steps marked `optional: true` |
| `src/routes/_authenticated/index.tsx` | Added PilotSection, removed placeholder |
| `src/types/common.ts` | Added CreatePilotInput, InstantiateMechInput |
| `src/lib/builderUtils.ts` | STARTING_MECH_BUDGET constant |

### Supabase Migrations (2)
| Migration | Purpose |
|-----------|---------|
| `add_pilot_personal_info_and_cleanup_triggers` | Personal info columns + cascade cleanup triggers |
| `fix_cleanup_function_search_path` | Security fix for mutable search_path |

## Test Coverage

### pilotUtils.test.ts (203 tests)
- **getDigitalSteps** (3): filters paperOnly, preserves order
- **resolveStepEntities** (5): class/ability/equipment resolution, contextFrom coreTrees filtering
- **rollOnTable** (4): known tables, unknown table fallback
- **validateStep** (11): all step types, min/max constraints, whitespace handling, optional step behavior (no selection, valid selection, over-max selection)
- **wizardReducer** (20): SELECT_ENTITY (add, replace, toggle, max enforcement, deselect toggle), DESELECT_ENTITY (remove, no-op cases), SET_TEXT (preserve selectedIds, initialize), SET_ROLL (values + auto-advance), GO_TO_STEP (normal, clamp negative, clamp overflow), RESET, auto-advance bounds, dependent step reset
- **canSubmitWizard** (7): empty state, complete pilot wizard, missing required step, mech wizard with optional systems/modules, missing chassis, missing pattern name
- **wizardToCreateInput** (8): missing class/ability/callsign returns null, valid input, optional text fields, empty equipment, callsign trimming
- **resolveConstraintMax** (5): static max, no constraints, scalesWithField system/module slots, missing contextFrom
- **validateStep with dynamic constraints** (2): at-max valid, over-max optional proceed
- **wizardReducer with dynamic constraints** (2): dynamic max enforcement, chassis change resets dependents
- **mechWizardToInstantiateInput** (9): missing chassis, chassis only, all fields, sort_order, whitespace trim, modules only, systems only, pattern_name trim, systems-before-modules ordering
- **PILOT_DEFAULTS** (1): expected values

### DisplayCard.test.tsx (suref-react, 18 tests)
- Disabled state preserves original header background with opacity
- Disabled state preserves source styling (expansion effects) with opacity

## Verification

- `bun run typecheck` - 0 errors across all packages
- `bun --filter in-the-union-now test` - 203 tests passing, 0 failures
- `bun --filter suref-react test` - 86 tests passing, 0 failures
- `bun --filter salvageunion-reference test` - 304 tests passing, 0 failures
