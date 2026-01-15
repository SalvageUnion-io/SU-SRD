# Extract Actions to Meta Schema (Name-Based References)

## Overview

Extract all `actions` arrays from embedded locations across the codebase into a new meta schema `actions.json`, following the exact pattern used by `chassis-abilities`. Actions will be referenced by **name** (not ID), and utilities will resolve names to full action objects transparently, ensuring front-end rendering continues unchanged.

## Current State Analysis

### Schemas with Actions Arrays

**Required actions:**
- `bio-titans` - required field
- `crawlers` - required field  
- `creatures` - required field
- `equipment` - required field
- `meld` - required field
- `npcs` - required field
- `squads` - required field
- `systems` - via `SURefMetaSystemModule` (required)
- `modules` - via `SURefMetaSystemModule` (required)

**Optional actions:**
- `abilities` - optional field

**Reference pattern (chassis-abilities):**
- Chassis have `chassisAbilities: string[]` (array of action names)
- `getChassisAbilities()` resolves names to full `SURefMetaAction[]` objects
- Front-end receives resolved action objects and renders normally

### Duplicate Actions Identified

**High-frequency duplicates:**
- "System Repair" - 12 occurrences (systems + equipment)
- "Patch" - 11 occurrences (systems + equipment)
- "Chassis Repair" - 11 occurrences (systems + equipment)
- "Portable Comms Unit" - 10 occurrences (equipment + npcs + squads)
- "Titanic Actions" - 7 occurrences (bio-titans + meld)

**Identical content duplicates:**
- Auto-Turret (abilities + equipment)
- System Repair variants (systems + equipment)
- Chassis Repair variants (systems + equipment)
- Portable Comms Unit (9 identical across npcs + squads)

**Total:** 460 actions found, 384 unique names, 30 duplicate name groups

## Implementation Plan

### Phase 1: Create Actions Meta Schema

1. **Create `schemas/actions.schema.json`**
   - Reference `shared/objects.schema.json#/definitions/action`
   - Mark as meta schema (identical to chassis-abilities pattern)
   - Required fields: `id`, `name`
   - File: `packages/salvageunion-reference/schemas/actions.schema.json`

2. **Create `data/actions.json`**
   - Extract all unique actions from existing data files
   - Deduplicate by content hash (keep one canonical version per unique content)
   - For actions with same name but different properties, create separate entries
   - Preserve all action IDs for tracking
   - Ensure action names are unique (handle name conflicts if any)
   - Initial estimate: ~400 unique actions
   - File: `packages/salvageunion-reference/data/actions.json`

3. **Update `schemas/index.json`**
   - Add actions schema entry with `meta: true`
   - Set displayName: "Actions"
   - File: `packages/salvageunion-reference/schemas/index.json`

4. **Update TypeScript types**
   - Add `SURefAction` type (alias to `SURefMetaAction`)
   - Update `SURefMetaSchemaName` to include `'actions'`
   - Generate types via `bun run generate`
   - Files: `packages/salvageunion-reference/lib/types/objects.ts` (generated)

### Phase 2: Update Data Files to Reference Actions by Name

1. **Replace embedded actions with name references**
   - Change `actions: SURefMetaAction[]` to `actions: string[]` (array of action names)
   - Update all data files:
     - `data/abilities.json` - change `actions` array to string array
     - `data/systems.json` - change `actions` array to string array
     - `data/modules.json` - change `actions` array to string array
     - `data/equipment.json` - change `actions` array to string array
     - `data/bio-titans.json` - change `actions` array to string array
     - `data/crawlers.json` - change `actions` array to string array
     - `data/creatures.json` - change `actions` array to string array
     - `data/meld.json` - change `actions` array to string array
     - `data/npcs.json` - change `actions` array to string array
     - `data/squads.json` - change `actions` array to string array

2. **Handle duplicate actions**
   - For identical actions (same content hash), use single action name
   - For similar actions (same name, different properties), create separate entries with unique names or handle via context
   - Document merge decisions in migration notes

### Phase 3: Update Schemas

1. **Update schema definitions**
   - `schemas/abilities.schema.json` - change actions to `type: "array", items: { type: "string" }`
   - `schemas/systems.schema.json` - change actions to string array
   - `schemas/modules.schema.json` - change actions to string array
   - `schemas/equipment.schema.json` - change actions to string array
   - `schemas/bio-titans.schema.json` - change actions to string array
   - `schemas/crawlers.schema.json` - change actions to string array
   - `schemas/creatures.schema.json` - change actions to string array
   - `schemas/meld.schema.json` - change actions to string array
   - `schemas/npcs.schema.json` - change actions to string array
   - `schemas/squads.schema.json` - change actions to string array
   - `schemas/shared/objects.schema.json` - update `systemModule` definition to use string array for actions

2. **Update TypeScript schema types**
   - Change `actions?: SURefMetaAction[]` to `actions?: string[]` in:
     - `SURefAbility`
     - `SURefBioTitan`
     - `SURefCrawler`
     - `SURefCreature`
     - `SURefEquipment`
     - `SURefMeld`
     - `SURefNPC`
     - `SURefSquad`
   - Change `actions: SURefMetaAction[]` to `actions: string[]` in:
     - `SURefMetaSystemModule`
   - Files: `packages/salvageunion-reference/lib/types/schemas.ts` (generated)

### Phase 4: Update Utilities to Resolve Actions by Name

1. **Update `lib/ModelFactory.ts`**
   - Import `actionsData` from `data/actions.json`
   - Add to `dataMap` with key `'actions'`
   - Import `actionsSchema` from `schemas/actions.schema.json`
   - Add to `schemaMap` with key `'actions'`
   - File: `packages/salvageunion-reference/lib/ModelFactory.ts`

2. **Update `lib/utilities.ts`**
   - **Modify `extractActions()`** to resolve action names to action objects:
     ```typescript
     export function extractActions(entity: SURefMetaEntity): SURefMetaAction[] | undefined {
       // Check if entity has actions array (now string[])
       if (!('actions' in entity) || !Array.isArray(entity.actions)) {
         return undefined
       }
       
       const actionNames = entity.actions as string[]
       
       // Resolve each action name to its full action object from actions schema
       const { dataMap } = getDataMaps()
       const actionsData = dataMap['actions'] as SURefMetaAction[] | undefined
       
       if (!actionsData) {
         console.warn('actions schema not found')
         return undefined
       }
       
       // Create a map of action name to action object
       const actionMap = new Map<string, SURefMetaAction>()
       actionsData.forEach((action) => {
         actionMap.set(action.name, action)
       })
       
       // Resolve each action name to its object
       const resolved: SURefMetaAction[] = []
       for (const actionName of actionNames) {
         if (typeof actionName !== 'string') {
           console.warn(`Invalid action: expected string, got ${typeof actionName}`)
           continue
         }
         const action = actionMap.get(actionName)
         if (action) {
           resolved.push(action)
         } else {
           console.warn(`Action "${actionName}" not found in actions schema`)
         }
       }
       
       return resolved.length > 0 ? resolved : undefined
     }
     ```
   - **Update `extractVisibleActions()`** - no changes needed (uses `extractActions()` which now resolves)
   - **Update `hasActions()`** - update type guard to check for string array:
     ```typescript
     export function hasActions(
       entity: SURefMetaEntity
     ): entity is SURefMetaEntity & { actions: string[] } {
       return 'actions' in entity && Array.isArray(entity.actions)
     }
     ```
   - File: `packages/salvageunion-reference/lib/utilities.ts`

3. **Update `lib/utilities-generated.ts`**
   - Regenerate utilities to handle string arrays for actions
   - Update action-related getters to work with resolved actions (no changes needed if they use `extractActions()`)
   - File: `packages/salvageunion-reference/lib/utilities-generated.ts` (generated)

### Phase 5: Verify Front-End Compatibility

1. **Verify components receive resolved actions**
   - `EntityActions.tsx` - uses `extractVisibleActions()` which now resolves names → no changes needed
   - `EntityTopMatter.tsx` - uses `extractVisibleActions()` → no changes needed
   - `NestedActionDisplay.tsx` - receives `SURefMetaAction` objects → no changes needed
   - `EntityListDisplay.tsx` - uses `extractVisibleActions()` → no changes needed
   - All components continue to receive full action objects, rendering unchanged

2. **Test action rendering**
   - Verify single-action entities render correctly
   - Verify multi-action entities render correctly
   - Verify hidden actions are filtered correctly
   - Verify action properties (activationCost, range, damage, traits) display correctly

### Phase 6: Testing and Validation

1. **Run validation scripts**
   - `bun run validate:ids` - ensure all action IDs are unique in actions.json
   - `bun run validate:references` - ensure all action name references are valid
   - `bun run typecheck` - ensure TypeScript types are correct

2. **Test data integrity**
   - Verify all actions are extracted correctly
   - Verify no actions are lost in migration
   - Verify duplicate actions are properly consolidated
   - Verify action name uniqueness in actions.json

3. **Test web application**
   - Verify all entity displays show actions correctly
   - Test action rendering in different contexts (abilities, systems, equipment, etc.)
   - Test chassis abilities (should remain unchanged)
   - Verify action properties display correctly

### Phase 7: Documentation

1. **Update CHANGELOG.md**
   - Document breaking changes (data structure change)
   - Document migration path
   - Note duplicate action consolidation
   - Note name-based reference pattern

2. **Update schema documentation**
   - Document actions meta schema
   - Document action reference pattern (by name, not ID)
   - Update examples to show name-based references
   - File: `packages/salvageunion-reference/docs/schemas/actions.md` (new)

## Key Files to Modify

### New Files
- `packages/salvageunion-reference/schemas/actions.schema.json`
- `packages/salvageunion-reference/data/actions.json`
- `packages/salvageunion-reference/docs/schemas/actions.md`

### Modified Files
- `packages/salvageunion-reference/schemas/index.json`
- `packages/salvageunion-reference/schemas/shared/objects.schema.json`
- `packages/salvageunion-reference/schemas/*.schema.json` (10 schema files)
- `packages/salvageunion-reference/data/*.json` (10 data files)
- `packages/salvageunion-reference/lib/ModelFactory.ts`
- `packages/salvageunion-reference/lib/utilities.ts`
- `packages/salvageunion-reference/lib/types/schemas.ts` (generated)
- `packages/salvageunion-reference/lib/types/objects.ts` (generated)
- `packages/salvageunion-reference/lib/utilities-generated.ts` (generated)

## Migration Strategy

1. **Preserve all action IDs** - maintain existing IDs in actions.json for tracking
2. **Use name-based references** - entities reference actions by name (string array)
3. **Resolve transparently** - utilities resolve names to full objects before returning
4. **Deduplicate by content** - merge identical actions, keep canonical version
5. **Maintain action properties** - preserve all action fields (hidden, traits, damage, etc.)
6. **Update references atomically** - update data files and schemas together
7. **Test incrementally** - validate after each phase

## Front-End Compatibility Guarantee

**Critical:** The front-end will continue to work exactly as it does now because:

1. **Utilities resolve names to objects** - `extractActions()` and `extractVisibleActions()` resolve action names to full `SURefMetaAction[]` objects
2. **Components receive full objects** - All React components receive resolved action objects, not name strings
3. **No component changes needed** - Components like `EntityActions`, `NestedActionDisplay`, etc. continue to work with `SURefMetaAction` objects
4. **Same rendering logic** - Action properties (activationCost, range, damage, traits, content) are all preserved in resolved objects

The resolution happens transparently in the utilities layer, so the front-end never sees the name strings - it only sees fully resolved action objects, exactly as it does today.

## Considerations

- **Name uniqueness** - Ensure all action names in actions.json are unique (handle conflicts if any)
- **Chassis abilities pattern** - Follow the exact same pattern as chassis-abilities (meta schema, name-based references, resolution in utilities)
- **Backward compatibility** - Utilities resolve names transparently, so application code doesn't need changes
- **Duplicate handling** - Document which duplicates were merged and why
- **Hidden actions** - Preserve `hidden` flag in actions schema, filter in `extractVisibleActions()`
- **Action properties** - All action properties (activationCost, range, damage, traits, content, etc.) remain in actions schema

