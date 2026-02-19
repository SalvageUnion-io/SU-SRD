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

**Tests:** 217 tests passing across `pilotUtils.test.ts`, `mechUtils.test.ts`, `entityRefUtils.test.ts`, `entityAccess.test.ts`, and `builderUtils.test.ts`.

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

Removed the green `ring-2 ring-green-500 ring-offset-1` from `DisplayCard` when `selected` is true. The `selected` prop was subsequently fully removed from the DisplayCard type and the entire EntityDisplay chain during Phase 3 cleanup.

### SectionSeparator Children Prop

Added optional `children?: ReactNode` to `SectionSeparator` — renders between the label text and trailing separator line.

## File Summary

### New Files (14)
| File | Purpose |
|------|---------|
| `src/hooks/useGuideInteractiveConfig.tsx` | Interactive guide step rendering with budget config + dynamic constraints (moved from components/pilots/) |
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
| `src/hooks/useAutosave.ts` | Debounced autosave hook |
| `src/hooks/useSaveStatus.ts` | Save status tracking hook |
| `src/routes/_authenticated/pilots/$pilotId/index.tsx` | Pilot detail/edit route |
| `src/routes/_authenticated/pilots/$pilotId/mech-bay.tsx` | Mech bay editing route |
| `src/components/patterns/PatternImageSlot.tsx` | Pattern/pilot image slot |
| `src/lib/entityAccess.ts` | Entity access control (view/edit) for patterns, pilots, mechs |
| `src/lib/entityAccess.test.ts` | Entity access tests |
| `src/lib/entityHelpers.ts` | Shared entity lookup helpers (findChassisById) |
| `src/lib/entityRefUtils.ts` | Pilot entity_ref generation (split from mechUtils) |
| `src/lib/entityRefUtils.test.ts` | Entity ref utils tests |
| `src/components/shared/PageSkeleton.tsx` | Shared loading skeleton |
| `src/components/shared/NotFoundState.tsx` | Shared not-found state |
| `src/components/shared/actionButtonClasses.ts` | Shared action button Tailwind classes |
| `src/components/shared/tagButtonClasses.ts` | Shared tag button Tailwind classes |
| `src/components/pilots/PilotStatControl.tsx` | Stat badge with +/- controls (extracted from route) |
| `src/components/pilots/PilotPersonalInfo.tsx` | Personal info fields with autosave (extracted from route) |
| `src/components/pilots/PilotEntityRefs.tsx` | Pilot abilities/equipment listings (extracted from route) |
| `src/components/pilots/PilotMechSection.tsx` | Mech section with create/navigate (extracted from route) |
| `plan-docs/phase-3/EXECUTION.md` | This document |

### Modified Files (8+)
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

## Phase 3 Cleanup

Post-implementation cleanup addressing dead code, DRY violations, and structural improvements.

### Dead Code & Bug Fixes (Phase A)
- Removed `selected` prop from DisplayCard and entire EntityDisplay chain (was accepted but silently dropped)
- Removed dead `customPilotImage` state from pilot detail page
- Removed duplicate `useMech()` call in PilotMechSection (passed as props from parent)
- Removed dead `_userId` parameter from `updateMechEntityRefs`
- Removed orphaned `PILOT_DEFAULTS` re-export from pilotUtils
- Fixed mid-file import in mechUtils, merged duplicate imports in useMechs
- Removed unnecessary `useCallback` in useSaveStatus (replaced with direct ternary)
- Fixed unnecessary BuilderState round-trip in mech-bay autosave
- Fixed ambient React type reference in entityControlTypes.ts

### DRY Extractions (Phase B)
- Extracted `PageSkeleton` component (eliminated 4 identical skeleton blocks)
- Extracted `NotFoundState` component (eliminated 4 identical not-found blocks)
- Extracted `actionButtonClasses()` utility (eliminated 10 duplicated 80+ char Tailwind strings)
- Extracted shared `tagButtonClasses` constants (eliminated duplicates in MechBuilder/PatternImageSlot)
- Exported `getEntityId` from entitySelectionUtils (removed local copy in EntitySelectionModal)
- Imported `rollD20` from pilotUtils in diceStore (removed duplicate)
- Extracted `findChassisById` helper (eliminated 5 `Chassis.find()` duplications)
- Extracted `clearTimer` helper in useAutosave (replaced 3 identical clearTimeout blocks)
- Extracted `formatRollResult` helper in pilotUtils
- Extracted `PatternOverrideData` type (eliminated 6 inline duplications across EntityDisplay files)
- Moved `abilityToEntityRef`/`equipmentToEntityRefs` from mechUtils to entityRefUtils
- Renamed `patternAccess` to `entityAccess` (used for patterns, pilots, and mechs)
- Extracted `isMechEquipmentRef` predicate in mechUtils

### Structural Refactors (Phase C)
- Split `$pilotId/index.tsx` from 567 to 250 lines by extracting 4 components (PilotStatControl, PilotPersonalInfo, PilotEntityRefs, PilotMechSection)
- Unified MechBuilder footer from two 70-line branches to single 60-line block
- Extracted `computeEntityInteractionState()` helper in GuideStepsDisplay (eliminated duplicated selection/greying logic)
- Extracted `StepRollSection` component in GuideStepsDisplay (eliminated ~80 duplicated lines)
- Moved `InteractiveGuideSteps.tsx` to `hooks/useGuideInteractiveConfig.tsx` (exports only hook + type)
- Aligned `mechKeys` query key factory with `pilotKeys`/`patternKeys` structure
- Extracted wizard step name constants in pilotUtils

### Deleted Files
- `src/lib/patternAccess.ts` (renamed to `entityAccess.ts`)
- `src/lib/patternAccess.test.ts` (renamed to `entityAccess.test.ts`)
- `src/components/pilots/InteractiveGuideSteps.tsx` (moved to hooks/)

## Action Use System

Added a complete action use system to the pilot detail page: Use button on action cards, AP cost tracking, limited use tracking, required trait validation, and autosave integration.

### Game Data: `requiredTraits` on Actions

Moved required trait information from hint content blocks to a structured field on the action schema.

- **Schema** (`packages/salvageunion-reference/lib/schemas/objects.ts`): Added `requiredTraits?: string[]` to `ActionSchema`
- **Data** (`packages/salvageunion-reference/data/actions.json`): Added `requiredTraits` field and removed hint content blocks on 7 actions (Area Salvage, Mech Salvage, Scrap → `["salvaging"]`; Load, Mount, Patch Up, Repair → `["rigging"]`)
- **Utility** (`packages/salvageunion-reference/lib/utilities.ts`): Added `getRequiredTraits(action)` → `string[]`

### suref-react Exports

- Exported `EntityDisplayTooltip` from barrel (`packages/suref-react/src/index.ts`)
- Added required traits rendering to `NestedActionDisplay.tsx` (italicized "Requires the **TRAIT** Trait." above content)

### Pure Utilities — Action Use Logic

**`src/lib/actionUsesUtils.ts`** (NEW) — Pure functions, no React/Supabase:
- `getActionActivationCost(action)` → `number | null` — numeric AP cost, null for undefined/0/X
- `getActionMaxUses(action)` → `number | null` — from `{ type: "uses", amount: N }` trait
- `getRemainingUses(actionName, refMetadata)` → `number | null` — from `metadata.actionUses[name]`
- `decrementActionUses(actionName, maxUses, currentMetadata)` → new metadata JSON (lazy-inits from maxUses)
- `getActionDisabledReason(opts)` → `string | null` — checks: required traits → AP → uses
- `getPilotTraits(refs)` → `Set<string>` — collects all trait types from pilot entity refs

**`src/lib/actionUsesUtils.test.ts`** (NEW) — 23 tests covering all functions

### Data Threading — ActionDisplayData

Extended `ActionDisplayData` in `src/lib/pilotActionUtils.ts`:
- Added fields: `actionName`, `entityRefId`, `activationCost`, `maxUses`, `usesRemaining`, `requiredTraits`
- `buildActionItems` accepts `entityRefId`/`refMetadata`, computes use tracking fields, transforms "Uses" DataValue to `"N/M"` format
- `extractPilotActions` passes `ref.id` and `ref.metadata` through
- `getGeneralActions` passes `null` for entityRefId (no use tracking, still gets Use button)

### DB Infrastructure

- **API** (`src/lib/api/pilotApi.ts`): Added `updateEntityRef(refId, input)` for metadata updates
- **Hook** (`src/hooks/usePilots.ts`): Added `useUpdateEntityRef()` mutation, invalidates entity refs on success

### ActionDisplay Component

**`src/components/pilots/ActionDisplay.tsx`** (NEW):
- Renders action cards with pale background, border color, data values, content blocks
- Props: `controls?: EntityControl[]`, `disabled?: boolean`, `footerMessage?: ReactNode`
- Disabled state: `opacity-50` on wrapper, content blocks hidden
- Footer: source entity chip (links to parent entity detail modal) + optional message

### PilotActionsSection — Use Button + Validation

**`src/components/pilots/PilotActionsSection.tsx`** (NEW):
- Renders three sections: Actions (from abilities/equipment), Passives (compact EntityDisplay), General Actions (generic abilities)
- **Use button** on all actions (not just those with entityRefId) — Play icon + "Use" label
- **Disabled validation**: checks required traits → AP → uses. Disabled button shows `cursor-not-allowed opacity-30`
- **Sorting**: enabled actions render before disabled ones via `sortEnabledFirst()`
- **Structured footer messages**: "Requires Trait: **SALVAGING**" with trait name as pseudoheader wrapped in `EntityDisplayTooltip` (hover shows trait rules text). Plain text for AP/uses reasons.
- **Use toast**: `toast("Callsign used Action Name")` with 2px border matching the action's color
- **Autosave integration**: AP changes via `onUpdatePilot`, use tracking via `onUpdateEntityRef` — both callbacks flow to parent page

### Pilot Detail Page Integration

**`src/routes/_authenticated/pilots/$pilotId/index.tsx`:**
- Lifted `useUpdateEntityRef` to page level
- `useSaveStatus` tracks both `updatePilot.isPending || updateEntityRef.isPending`
- Removed per-save `toast.success('Pilot updated')` — footer status handles feedback ("Saving..."/"Saved just now")
- Passes `pilot`, `readOnly`, `onUpdatePilot`, `onUpdateEntityRef` to PilotActionsSection

### Metadata Schema

Stored in `entity_refs.metadata` (JSON column):
```json
{ "actionUses": { "Area Salvage": 3 } }
```
Lazy init: null = full uses. First "Use" writes `maxUses - 1`.

### New Files (4)
| File | Purpose |
|------|---------|
| `src/lib/actionUsesUtils.ts` | Pure utilities for AP cost, uses tracking, trait validation |
| `src/lib/actionUsesUtils.test.ts` | 23 tests for action use utilities |
| `src/lib/pilotActionUtils.ts` | Action extraction, color computation, display data threading |
| `src/lib/pilotActionUtils.test.ts` | 16 tests for pilot action utilities |
| `src/components/pilots/ActionDisplay.tsx` | Action card component with controls, disabled state, footer |
| `src/components/pilots/PilotActionsSection.tsx` | Action sections with Use button, validation, sorting, toasts |

### Modified Files
| File | Change |
|------|--------|
| `packages/salvageunion-reference/lib/schemas/objects.ts` | `requiredTraits?: string[]` on ActionSchema |
| `packages/salvageunion-reference/data/actions.json` | requiredTraits field on 7 actions, removed hint blocks |
| `packages/salvageunion-reference/lib/utilities.ts` | `getRequiredTraits()` utility |
| `packages/suref-react/src/index.ts` | Exported `EntityDisplayTooltip` |
| `packages/suref-react/src/components/entity/NestedActionDisplay.tsx` | Required traits italicized rendering |
| `src/lib/api/pilotApi.ts` | `updateEntityRef()` function |
| `src/hooks/usePilots.ts` | `useUpdateEntityRef()` hook |
| `src/routes/_authenticated/pilots/$pilotId/index.tsx` | Autosave integration, lifted entity ref mutation |

## Verification

- `bun run typecheck` - 0 source errors across all packages (pre-existing vite.config.ts version mismatch only)
- `bun --filter in-the-union-now test` - 258 tests passing, 0 failures
- `bun --filter suref-react test` - 86 tests passing, 0 failures
- `bun --filter suref-web test` - 783 tests passing, 0 failures
- `bun run lint` - 0 warnings
- `bun run format -- --check` - all files formatted
