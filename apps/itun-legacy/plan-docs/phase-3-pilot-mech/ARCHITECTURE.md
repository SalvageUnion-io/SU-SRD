# Phase 3 — Pilot (with Mech) Builder & CRUD — Architecture

## Wizard Engine: Dual-Mode GuideStepsDisplay

### Current State (suref-react)

`GuideStepsDisplay` is a **read-only** component that renders guide steps with:

- Section headers (pseudoheader style)
- Step numbers (reset per section)
- Content blocks via `BlockContentRendererView`
- Resolved entity listings via `renderEntityListing` render prop
- Roll table entity resolution
- Sidebar layout variant for entity displays
- Filtering via `enrichForFiltering` + `matchesFilter`

### Interactive Extension (ITUN)

ITUN wraps `GuideStepsDisplay` with an interactive wizard engine. The approach is **composition, not modification** — suref-react's component stays read-only, and ITUN builds an `InteractiveGuideWizard` that:

1. Reads guide steps from `salvageunion-reference` (same data as suref-web)
2. Filters out `paperOnly` steps
3. Manages wizard state in a Zustand store
4. Renders each step as an interactive form based on `stepType`
5. Enforces constraints, dependencies, and context resolution
6. Persists results to Supabase on completion

All wizard steps render inside **DisplayCard** containers, maintaining the same header/content/footer visual structure used throughout the app.

### Step Type -> Interactive Component Mapping

| `stepType`    | Component        | Behavior                                                                                                                    |
| ------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `info`        | `InfoStep`       | Read-only content display. May show scrap budget or entity stats. Auto-advances.                                            |
| `select-one`  | `SelectOneStep`  | Card grid of resolved entities. Click to select. Shows entity detail on hover/tap. Enforces filters.                        |
| `select-many` | `SelectManyStep` | Card grid with multi-select. Shows running count vs constraint max. Tracks scrap cost for mech creation.                    |
| `roll-table`  | `RollTableStep`  | Displays roll table. "Roll" button or "Choose manually" toggle. For `columns` type tables (callsign), two sequential rolls. |
| `freeform`    | `FreeformStep`   | Text input(s). For crawler NPC naming, renders one input per bay NPC.                                                       |
| `sub-guide`   | `SubGuideStep`   | Recursively renders another guide's wizard steps inline.                                                                    |

### Wizard State (Zustand Store)

```typescript
type WizardState = {
  guideId: string
  steps: WizardStep[]
  currentStepIndex: number
  selections: Map<string, StepSelection>
  scrapBudget: number | null
  contextValues: Map<string, unknown>
  status: 'active' | 'completing' | 'completed' | 'error'

  // Actions
  selectValue: (stepId: string, value: StepSelection) => void
  nextStep: () => void
  prevStep: () => void
  canAdvance: () => boolean
  complete: () => Promise<void>
}
```

### Dependency & Context Resolution

- **`dependsOn`**: Step is disabled/hidden until all listed step IDs have selections.
- **`contextFrom`**: The selected entity from the referenced step provides context.
- **`filters`**: Applied during entity resolution. Uses existing `matchesFilter` + `enrichForFiltering`.
- **`constraints.scalesWithField`**: Resolves the max from the context entity's field value.

---

## Pilot Detail View — Load In / Load Out

### DisplayCard-Based Layout

The pilot detail uses a **single DisplayCard** whose header content dynamically swaps based on the load state. All pilots, mechs, wizard steps, and sheets share the DisplayCard visual structure.

```typescript
type PilotDetailState = {
  loadState: 'pilot' | 'mech' // Default: 'pilot'
}
```

### Pilot-Forward Layout (Default)

```
+----------------------------------------------+
| HEADER (bg-su-orange)                         |
| [Class icon]  [Callsign]         HP: 10/10   |
|               Engineer            AP: 5/5    |
|               Background: ...     TP: 0      |
+----------------------------------------------+
| [Load In] button (active if mech pilotable)   |
+----------------------------------------------+
|                                              |
| ABILITIES                                    |
| +----------+ +----------+                   |
| | Ability  | |          |                   |
| +----------+ +----------+                   |
|                                              |
| EQUIPMENT                                    |
| +----------+ +----------+                   |
| | Item 1   | | Item 2   |                   |
| +----------+ +----------+                   |
|                                              |
| INVENTORY                                    |
| [cargo items list]                           |
|                                              |
| MECH (secondary display, compact)            |
| +------------------------------------------+|
| | Scrapper - "Bullseye"  SP:16 EP:8 HC:6   ||
| +------------------------------------------+|
+----------------------------------------------+
| FOOTER (bg-su-orange)                         |
+----------------------------------------------+
```

### Mech-Forward Layout ("Loaded In")

```
+----------------------------------------------+
| HEADER (bg-su-green)                          |
| [Chassis img] [Pattern Name]      SP: 16/16  |
|               Scrapper             EP: 8/8   |
|               Chassis Ability...   Heat: 0/6 |
+----------------------------------------------+
| [Load Out] button                             |
+----------------------------------------------+
|                                              |
| SYSTEMS (highlighted)                        |
| +----------+ +----------+ +----------+      |
| | System 1 | | System 2 | | System 3 |      |
| | [actions]| | [actions]| | [actions]|      |
| +----------+ +----------+ +----------+      |
|                                              |
| MODULES                                      |
| +----------+ +----------+                   |
| | Module 1 | | Module 2 |                   |
| +----------+ +----------+                   |
|                                              |
| PILOT (secondary display, compact)           |
| +------------------------------------------+|
| | Engineer "Scrappy"  HP:10 AP:5 TP:0      ||
| | Abilities: [...], Equipment: [...]        ||
| +------------------------------------------+|
|                                              |
| INVENTORY                                    |
| [combined pilot + mech cargo]                |
+----------------------------------------------+
| FOOTER (bg-su-green)                          |
+----------------------------------------------+
```

### Load In Button Logic

```typescript
const isPilotable = (mech: MechRow | null, chassisCondition: ItemCondition): boolean => {
  if (!mech) return false
  // Mech is pilotable if:
  // 1. Has SP remaining (0 SP = destroyed)
  // 2. Chassis is not damaged or destroyed (damaged chassis = entire mech inoperable)
  // Individual systems/modules may be damaged (inoperable) without affecting pilotability
  return mech.current_sp > 0 && chassisCondition === 'intact'
}

// In PilotDetail component:
const [loadState, setLoadState] = useState<'pilot' | 'mech'>('pilot')
const canLoadIn = isPilotable(mechData)

<Button
  onClick={() => setLoadState(prev => prev === 'pilot' ? 'mech' : 'pilot')}
  disabled={loadState === 'pilot' && !canLoadIn}
>
  {loadState === 'pilot' ? 'Load In' : 'Load Out'}
</Button>
```

Note: The DisplayCard header color also changes — `bg-su-orange` for pilot-forward, `bg-su-green` for mech-forward.

---

## MechBuilder in Phase 3 Contexts

The unified MechBuilder from Phase 2 is reused with constraint props:

### Mech Creation Context (During Pilot Setup)

```tsx
<MechBuilder
  scrapBudget={20}
  techLevelFilter={1}
  showScrapTracker
  onSave={handleMechCreate}
  saveLabel="Create Mech"
  nameRequired={false}
/>
```

### Mech Editor Context (Pilot Assigned to Crawler)

When a pilot is assigned to a crawler, mech modifications draw from the **crawler's scrap inventory**. The available budget is the crawler's scrap at the relevant tech levels.

```tsx
<MechBuilder
  initialChassis={mech.chassis_ref}
  initialSystems={currentSystemRefs}
  initialModules={currentModuleRefs}
  initialName={mech.pattern_name}
  scrapBudget={crawlerTotalScrap} // Drawn from crawler's scrap_tl1..tl6
  scrapByTechLevel={crawlerScrapMap} // { 1: 15, 2: 4, 3: 0, ... }
  onSave={handleMechUpdate}
  saveLabel="Update Mech"
/>
```

### Mech Editor Context (Pilot NOT Assigned to Crawler)

Unassigned pilots can freely edit their mech with **no scrap cost** — like the Pattern Builder but embedded in the pilot sheet. This represents operating independently outside of a crawler's economy.

```tsx
<MechBuilder
  initialChassis={mech.chassis_ref}
  initialSystems={currentSystemRefs}
  initialModules={currentModuleRefs}
  initialName={mech.pattern_name}
  scrapBudget={null} // null = unlimited (same as pattern builder)
  onSave={handleMechUpdate}
  saveLabel="Update Mech"
/>
```

---

## Scrap Economy

> **Phase boundary note**: The scrap economy architecture is defined here for completeness (it's tightly coupled to mech management), but crawler-dependent operations (Unload Cargo, Load Cargo, Refund to crawler, Install from crawler scrap) are **wired in Phase 4** when crawlers exist. Phase 3 implements only the "unassigned pilot = free editing" path. The code below ships in Phase 4.

### Overview

The **crawler is the communal scrap pool**. Pilots do not have an independent scrap budget. Scrap is tracked per tech level on the crawler (`scrap_tl1` through `scrap_tl6`). All mech upgrades for assigned pilots deduct from the crawler's pool.

### Scrap Cost Confirmation Dialog

**Any action that costs communal scrap** (adding/removing/swapping systems or modules, changing chassis, applying a pattern) shows a **confirmation dialog** before executing:

```typescript
type ScrapCostConfirmation = {
  action: string // "Install Red Laser", "Apply Pattern: Bullseye", "Swap Chassis to Mule"
  costs: Array<{ techLevel: number; amount: number }> // e.g., [{ techLevel: 1, amount: 5 }]
  refunds: Array<{ techLevel: number; amount: number }> // Scrap returned from removed items
  netCost: Array<{ techLevel: number; amount: number }> // Net after refunds
  canAfford: boolean // Does the crawler have enough?
  crawlerScrap: Record<number, number> // Current crawler scrap for context
}
```

The dialog shows:

- What the action will do
- Cost breakdown by TL
- Any scrap refunded from removed items
- Net cost
- Whether the crawler can afford it
- Confirm/Cancel buttons (Confirm disabled if `canAfford === false`)

This dialog appears for:

- Adding a system or module to the mech
- Removing a system or module (shows refund amount)
- Swapping chassis
- Applying a pattern (shows total cost: new items minus refunded old items)

### "Unload Cargo" Button

On the pilot's mech view (when loaded in), a **"Unload Cargo"** button transfers all scrap and cargo from the mech to the crawler:

```typescript
const dumpScrap = async (mechId: string, crawlerId: string) => {
  // 1. Get all cargo items on the mech
  const mechCargo = await cargoApi.listByParent(mechId, 'mech')

  for (const item of mechCargo) {
    if (item.schema_name && item.schema_ref_id) {
      // Item has game data reference — resolve scrap value
      const entity = resolveEntity(item.schema_name, item.schema_ref_id)
      const tl = entity.techLevel || 1
      const scrapValue = entity.salvageValue || 0

      // Add scrap value to crawler pool at appropriate TL
      await crawlerApi.addScrap(crawlerId, tl, scrapValue * item.amount)
    } else {
      // Abstract scrap or custom item — move to crawler storage
      await cargoApi.update(item.id, {
        parent_id: crawlerId,
        parent_type: 'crawler',
      })
    }
  }

  // 2. Remove all cargo from mech
  await cargoApi.deleteByParent(mechId, 'mech')
}
```

### "Load Cargo" Button

Opens a selection UI where the user picks items to load onto the mech from the crawler:

```typescript
type LoadCargoSource =
  | { type: 'entity'; schemaName: 'chassis' | 'systems' | 'modules'; schemaRefId: string }
  | { type: 'scrap'; techLevel: number; amount: number }
  | { type: 'cargo'; cargoId: string } // Existing cargo item from crawler storage

const loadCargo = async (mechId: string, crawlerId: string, source: LoadCargoSource) => {
  switch (source.type) {
    case 'entity':
      // Move a game entity from crawler storage to mech cargo
      await cargoApi.create({
        parent_id: mechId,
        parent_type: 'mech',
        name: resolveEntity(source.schemaName, source.schemaRefId).name,
        schema_name: source.schemaName,
        schema_ref_id: source.schemaRefId,
        amount: 1,
      })
      // Remove from crawler storage
      break
    case 'scrap':
      // Transfer scrap from crawler pool to mech cargo
      await crawlerApi.addScrap(crawlerId, source.techLevel, -source.amount)
      await cargoApi.create({
        parent_id: mechId,
        parent_type: 'mech',
        name: `TL${source.techLevel} Scrap`,
        amount: source.amount,
      })
      break
    case 'cargo':
      // Transfer existing cargo item from crawler to mech
      await cargoApi.transferToParent(source.cargoId, mechId, 'mech')
      break
  }
}
```

Selection UI shows:

- Crawler storage items (cargo with `parent_type='crawler'`)
- Game entities: chassis, systems, modules (selectable types)
- Scrap by TL (with amount picker)
- Subject to mech cargo capacity

### "Refund" Mech Piece

Players can refund an installed system or module from their active mech:

```typescript
const refundEntityRef = async (
  entityRefId: string,
  mechId: string,
  crawlerId: string,
  mode: 'scrap' | 'store'
) => {
  const entityRef = await entityRefApi.getById(entityRefId)
  const entity = resolveEntity(entityRef.schema_name, entityRef.schema_ref_id)

  if (mode === 'scrap') {
    // Convert to scrap — add value to crawler pool
    const tl = entity.techLevel || 1
    const scrapValue = entity.salvageValue || 0
    await crawlerApi.addScrap(crawlerId, tl, scrapValue)
  } else {
    // Move to crawler storage — preserve as cargo item
    await cargoApi.create({
      parent_id: crawlerId,
      parent_type: 'crawler',
      name: entity.name,
      schema_name: entityRef.schema_name,
      schema_ref_id: entityRef.schema_ref_id,
      amount: 1,
    })
  }

  // Remove from mech
  await entityRefApi.delete(entityRefId)
}
```

### Scrap Deduction on Upgrade

When a pilot adds a system/module to their mech (and is assigned to a crawler):

```typescript
const installFromCrawlerScrap = async (
  mechId: string,
  crawlerId: string,
  schemaName: string,
  schemaRefId: string
) => {
  const entity = resolveEntity(schemaName, schemaRefId)
  const tl = entity.techLevel || 1
  const cost = entity.salvageValue || 0

  // Check crawler has enough scrap at this TL
  const crawler = await crawlerApi.getById(crawlerId)
  const scrapField = `scrap_tl${tl}` as keyof CrawlerRow
  if ((crawler[scrapField] as number) < cost) {
    throw new Error(`Not enough TL${tl} scrap (need ${cost}, have ${crawler[scrapField]})`)
  }

  // Deduct scrap
  await crawlerApi.addScrap(crawlerId, tl, -cost)

  // Install on mech
  await entityRefApi.create({
    parent_id: mechId,
    parent_type: 'mech',
    schema_name: schemaName,
    schema_ref_id: schemaRefId,
  })
}
```

---

## API Layer

### `src/lib/api/pilotApi.ts` (NEW)

```typescript
export const pilotApi = {
  list: async (): Promise<PilotRow[]>
  getById: async (id: string): Promise<PilotWithRelations>
  create: async (data: CreatePilotInput): Promise<PilotRow>
  update: async (id: string, data: UpdatePilotInput): Promise<PilotRow>
  delete: async (id: string): Promise<void>
}
```

### `src/lib/api/mechApi.ts` (NEW)

```typescript
export const mechApi = {
  getByPilotId: async (pilotId: string): Promise<MechWithRelations | null>
  create: async (data: CreateMechInput): Promise<MechRow>
  update: async (id: string, data: UpdateMechInput): Promise<MechRow>
  applyPattern: async (mechId: string, patternId: string): Promise<MechRow>
  saveAsPattern: async (mechId: string, name: string): Promise<MechPatternRow>
}
```

### `src/lib/api/entityRefApi.ts` (NEW)

```typescript
export const entityRefApi = {
  listByParent: async (parentId: string, parentType: ParentType): Promise<EntityRefRow[]>
  create: async (data: CreateEntityRefInput): Promise<EntityRefRow>
  update: async (id: string, data: UpdateEntityRefInput): Promise<EntityRefRow>
  delete: async (id: string): Promise<void>
  bulkReplace: async (parentId: string, parentType: ParentType, refs: CreateEntityRefInput[]): Promise<EntityRefRow[]>
}
```

### `src/lib/api/cargoApi.ts` (NEW)

```typescript
export const cargoApi = {
  listByParent: async (parentId: string, parentType: ParentType): Promise<CargoRow[]>
  create: async (data: CreateCargoInput): Promise<CargoRow>
  update: async (id: string, data: UpdateCargoInput): Promise<CargoRow>
  delete: async (id: string): Promise<void>
  deleteByParent: async (parentId: string, parentType: ParentType): Promise<void>
  transferToParent: async (cargoId: string, newParentId: string, newParentType: ParentType): Promise<CargoRow>
}
```

### `src/lib/api/playerChoiceApi.ts` (NEW)

```typescript
export const playerChoiceApi = {
  listByParent: async (parentId: string, parentType: ParentType): Promise<PlayerChoiceRow[]>
  create: async (data: CreatePlayerChoiceInput): Promise<PlayerChoiceRow>
  update: async (id: string, data: UpdatePlayerChoiceInput): Promise<PlayerChoiceRow>
  delete: async (id: string): Promise<void>
  bulkCreate: async (choices: CreatePlayerChoiceInput[]): Promise<PlayerChoiceRow[]>
}
```

### Equipment Management

Pilot equipment is managed through **`entityRefApi`** (same as systems/modules) — not a separate API. Equipment items are `entity_refs` with `parent_type='pilot'` and `schema_name='equipment'`.

```typescript
// Loading pilot equipment:
const equipmentRefs = await entityRefApi.listByParent(pilotId, 'pilot')
const equipment = equipmentRefs.filter((ref) => ref.schema_name === 'equipment')

// Swapping equipment:
await entityRefApi.delete(oldEquipmentRefId)
await entityRefApi.create({
  parent_id: pilotId,
  parent_type: 'pilot',
  schema_name: 'equipment',
  schema_ref_id: newEquipmentId,
})

// Inventory slot enforcement (6 max):
const currentSlots = equipment.length
if (currentSlots >= 6) throw new Error('Inventory full (6/6 slots)')
```

When assigned to a crawler, equipment swapping is gated by crawler TL (only equipment at or below `crawler.tech_level`). Unassigned pilots can swap freely.

### Query Key Factories

```typescript
export const pilotKeys = {
  all: ['pilots'] as const,
  lists: () => [...pilotKeys.all, 'list'] as const,
  details: () => [...pilotKeys.all, 'detail'] as const,
  detail: (id: string) => [...pilotKeys.details(), id] as const,
}

export const mechKeys = {
  all: ['mechs'] as const,
  byPilot: (pilotId: string) => [...mechKeys.all, 'pilot', pilotId] as const,
  detail: (id: string) => [...mechKeys.all, 'detail', id] as const,
}

export const entityRefKeys = {
  all: ['entityRefs'] as const,
  byParent: (parentId: string, parentType: string) =>
    [...entityRefKeys.all, parentType, parentId] as const,
}

export const cargoKeys = {
  all: ['cargo'] as const,
  byParent: (parentId: string, parentType: string) =>
    [...cargoKeys.all, parentType, parentId] as const,
}
```

### TanStack Query Hooks

```typescript
// src/hooks/usePilots.ts
export function usePilots(): UseQueryResult<PilotRow[]>
export function usePilot(id: string): UseQueryResult<PilotWithRelations>
export function useCreatePilot(): UseMutationResult<PilotRow, Error, CreatePilotInput>
export function useUpdatePilot(): UseMutationResult<
  PilotRow,
  Error,
  { id: string; data: UpdatePilotInput }
>
export function useDeletePilot(): UseMutationResult<void, Error, string>

// src/hooks/useMechs.ts
export function useMechByPilot(pilotId: string): UseQueryResult<MechWithRelations | null>
export function useCreateMech(): UseMutationResult<MechRow, Error, CreateMechInput>
export function useUpdateMech(): UseMutationResult<
  MechRow,
  Error,
  { id: string; data: UpdateMechInput }
>
export function useApplyPattern(): UseMutationResult<
  MechRow,
  Error,
  { mechId: string; patternId: string }
>

// src/hooks/useEntityRefs.ts
export function useEntityRefs(parentId: string, parentType: string): UseQueryResult<EntityRefRow[]>
export function useCreateEntityRef(): UseMutationResult<EntityRefRow, Error, CreateEntityRefInput>
export function useDeleteEntityRef(): UseMutationResult<void, Error, string>
export function useBulkReplaceEntityRefs(): UseMutationResult<
  EntityRefRow[],
  Error,
  { parentId: string; parentType: string; refs: CreateEntityRefInput[] }
>

// src/hooks/useCargo.ts
export function useCargo(parentId: string, parentType: string): UseQueryResult<CargoRow[]>
export function useCreateCargo(): UseMutationResult<CargoRow, Error, CreateCargoInput>
export function useDeleteCargo(): UseMutationResult<void, Error, string>

// src/hooks/usePlayerChoices.ts
export function usePlayerChoices(
  parentId: string,
  parentType: string
): UseQueryResult<PlayerChoiceRow[]>
export function useBulkCreatePlayerChoices(): UseMutationResult<
  PlayerChoiceRow[],
  Error,
  CreatePlayerChoiceInput[]
>
```

---

## Routing

### New Routes

```
src/routes/_authenticated/
+-- pilots/
|   +-- new.tsx               # Create Pilot wizard (pilot + mech combined)
|   +-- $pilotId.tsx          # Pilot detail (Load In / Load Out)
+-- mechs/
    +-- new.tsx               # Standalone mech creation (for pilots without mech)
```

### Pilot Creation Flow

The `/pilots/new` route manages a two-phase wizard:

1. Pilot creation wizard steps (7 steps from `character-creation` guide)
2. On pilot wizard completion -> transition to mech creation (MechBuilder with scrap constraints)
3. On mech completion -> navigate to pilot detail view

---

## Pilot Roster

### `src/components/dashboard/PilotSection.tsx` (NEW)

- Pseudoheader: "PILOTS"
- Grid of pilot cards (catalog-style)
- "Create a Pilot" button -> navigates to `/pilots/new`
- Each card shows: callsign, class name, mech chassis (if exists)
- Click card -> navigates to `/pilots/$pilotId`
- Empty state message
- Loading state with skeleton cards

### `src/components/dashboard/PilotCard.tsx` (NEW)

Catalog-style card (orange left border — pilot color).

---

## File Summary

### New Files -- 16+

```
# Wizard engine
src/components/wizard/InteractiveGuideWizard.tsx
src/components/wizard/InfoStep.tsx
src/components/wizard/SelectOneStep.tsx
src/components/wizard/SelectManyStep.tsx
src/components/wizard/RollTableStep.tsx
src/components/wizard/FreeformStep.tsx
src/lib/stores/wizardStore.ts

# Pilot
src/lib/api/pilotApi.ts
src/lib/api/mechApi.ts
src/lib/api/entityRefApi.ts
src/hooks/usePilots.ts
src/hooks/useMechs.ts
src/types/pilot.ts
src/types/mech.ts

# Routes
src/routes/_authenticated/pilots/new.tsx
src/routes/_authenticated/pilots/$pilotId.tsx
src/routes/_authenticated/mechs/new.tsx

# Pilot detail
src/components/pilot/PilotDetail.tsx
src/components/pilot/PilotHeader.tsx
src/components/pilot/MechHeader.tsx
src/components/pilot/SecondaryStatDisplay.tsx
src/components/pilot/LoadButton.tsx

# Dashboard
src/components/dashboard/PilotSection.tsx
src/components/dashboard/PilotCard.tsx
```

### Modified Files -- 1

```
src/routes/_authenticated/index.tsx   -- Add PilotSection to dashboard
```

---

## Implementation Order

1. **Types** -- pilot.ts, mech.ts
2. **API layers** -- pilotApi, mechApi, entityRefApi
3. **Query hooks** -- usePilots, useMechs
4. **Wizard engine** -- wizardStore, InteractiveGuideWizard, step components
5. **Pilot creation route** -- /pilots/new (pilot wizard + mech wizard)
6. **Pilot detail** -- PilotDetail with Load In / Load Out, PilotHeader, MechHeader, SecondaryStatDisplay
7. **Mech modification** -- Reuse MechBuilder with mech editor context
8. **Pattern application** -- Apply pattern to mech, save mech as pattern
9. **Dashboard** -- PilotSection, PilotCard
