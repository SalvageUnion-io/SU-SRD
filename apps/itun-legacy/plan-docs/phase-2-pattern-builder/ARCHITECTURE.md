# Phase 2 — Pattern Builder + CRUD — Architecture

## MechBuilder: Unified Component

The MechBuilder is the core interactive component used by the Pattern Builder (this phase), Mech Creation (Phase 3), and Mech Editor (Phase 3). It is built on top of the extracted `DisplayCard` component from Phase 1.

### Component API

```typescript
type MechBuilderProps = {
  /** Initial state (for editing existing pattern or mech) */
  initialChassis?: string
  initialSystems?: string[]
  initialModules?: string[]
  initialName?: string

  /** Constraint mode */
  scrapBudget?: number | null // null = unlimited (pattern builder)
  scrapByTechLevel?: Record<number, number> // Per-TL budget from crawler (Phase 4)
  techLevelFilter?: number // Filter entities to this TL (1 for starting mech)
  entityFilter?: string[] // Restrict to specific entity IDs (from guide data)

  /** Save behavior */
  onSave: (result: MechBuilderResult) => Promise<void>
  saveLabel?: string // "Save Pattern" | "Create Mech" | "Update Mech"
  nameRequired?: boolean // true for patterns, false/optional for mechs

  /** UI customization */
  headerBg?: string // Default: "bg-su-green" (chassis color)
  showScrapTracker?: boolean // Show budget bar (mech creation)
}

type MechBuilderResult = {
  chassisRef: string
  name: string
  systems: Array<{ schemaRefId: string; sortOrder: number }>
  modules: Array<{ schemaRefId: string; sortOrder: number }>
  remainingScrap?: number
}
```

### Visual Layout (inside DisplayCard)

```
+----------------------------------------------+
| HEADER (bg-su-green)                          |
| [TL/image]  [Pattern Name input]   [Stats]   |
|             Chassis Name            SP/EP/HC  |
+----------------------------------------------+
|                                              |
| [Select Chassis] button (if none selected)   |
|                                              |
| CHASSIS ABILITY (if chassis selected)        |
| +------------------------------------+       |
| | [Chassis ability - nested display] |       |
| +------------------------------------+       |
|                                              |
| SYSTEMS (X / Y slots used)        [+ Add]   |
| +----------+ +----------+ +----------+      |
| | System 1 | | System 2 | | System 3 |      |
| | compact  | | compact  | | compact  |      |
| | listing  | | listing  | | listing  |      |
| +----------+ +----------+ +----------+      |
|                                              |
| MODULES (X / Y slots used)        [+ Add]   |
| +----------+ +----------+                   |
| | Module 1 | | Module 2 |                   |
| | compact  | | compact  |                   |
| +----------+ +----------+                   |
|                                              |
| [Scrap Budget: 12 / 20 remaining] (Phase 3) |
|                                              |
+----------------------------------------------+
| FOOTER (bg-su-green)                         |
| Sys: 3/4 slots  |  Mod: 2/2 slots   [Save] |
+----------------------------------------------+
```

### State Management

Local component state via `useState` (no Zustand store — single-screen form):

```typescript
type MechBuilderState = {
  chassisRef: string | null
  chassisData: SURefChassis | null
  name: string
  systems: Array<{ schemaRefId: string; data: unknown; slotsRequired: number }>
  modules: Array<{ schemaRefId: string; data: unknown; slotsRequired: number }>
}
```

Validation:

- `systems` total `slotsRequired` <= `chassisData.systemSlots`
- `modules` total `slotsRequired` <= `chassisData.moduleSlots`
- `name` non-empty when `nameRequired` is true
- When `scrapBudget` is set: chassis `salvageValue` + sum of system/module `salvageValue` <= budget

---

## EntitySelectionModal

Reusable modal component for selecting chassis/systems/modules. Built with ShadCN `Dialog`.

```typescript
type EntitySelectionModalProps = {
  schemaName: 'chassis' | 'systems' | 'modules'
  isOpen: boolean
  onClose: () => void
  onSelect: (entityId: string, entity: unknown) => void
  filter?: (entity: unknown) => boolean // TL filter, etc.
  disabledIds?: string[] // Already installed
  title: string // "Select Chassis" | "Add System" | "Add Module"
}
```

Renders a grid of compact entity display listings using DisplayCard in compact mode. Click to select and close.

---

## API Layer

### `src/lib/api/patternApi.ts` (NEW)

```typescript
export const patternApi = {
  list: async (): Promise<MechPatternRow[]>
  getById: async (id: string): Promise<MechPatternRow>
  create: async (data: CreatePatternInput): Promise<MechPatternRow>
  update: async (id: string, data: UpdatePatternInput): Promise<MechPatternRow>
  delete: async (id: string): Promise<void>
}
```

### `src/hooks/usePatterns.ts` (NEW)

```typescript
export const patternKeys = {
  all: ['patterns'] as const,
  lists: () => [...patternKeys.all, 'list'] as const,
  details: () => [...patternKeys.all, 'detail'] as const,
  detail: (id: string) => [...patternKeys.details(), id] as const,
}

export function usePatterns(): UseQueryResult<MechPatternRow[]>
export function usePattern(id: string): UseQueryResult<MechPatternRow>
export function useCreatePattern(): UseMutationResult<MechPatternRow, Error, CreatePatternInput>
export function useUpdatePattern(): UseMutationResult<MechPatternRow, Error, UpdatePatternInput>
export function useDeletePattern(): UseMutationResult<void, Error, string>
```

---

## Types

### `src/types/pattern.ts` (NEW)

```typescript
import type { Database } from './database-generated.types'

export type MechPatternRow = Database['public']['Tables']['mech_patterns']['Row']
export type MechPatternInsert = Database['public']['Tables']['mech_patterns']['Insert']

export type PatternItem = {
  schema_name: 'systems' | 'modules'
  schema_ref_id: string
  sort_order: number
}

export type CreatePatternInput = {
  chassis_ref: string
  name: string
  description?: string
  pattern_items: PatternItem[]
}

export type UpdatePatternInput = Partial<CreatePatternInput>
```

---

## Pattern Routes

### `src/routes/_authenticated/patterns/new.tsx` (NEW)

```typescript
function CreatePattern() {
  const navigate = useNavigate()
  const createPattern = useCreatePattern()

  const handleSave = async (result: MechBuilderResult) => {
    await createPattern.mutateAsync({
      chassis_ref: result.chassisRef,
      name: result.name,
      pattern_items: [...result.systems, ...result.modules].map((s, i) => ({
        schema_name: /* resolved at component level */,
        schema_ref_id: s.schemaRefId,
        sort_order: i,
      })),
    })
    navigate({ to: '/' })
  }

  return <MechBuilder onSave={handleSave} nameRequired saveLabel="Save Pattern" />
}
```

### `src/routes/_authenticated/patterns/$patternId.tsx` (NEW)

```typescript
function EditPattern() {
  const { patternId } = Route.useParams()
  const { data: pattern } = usePattern(patternId)
  const updatePattern = useUpdatePattern()
  const deletePattern = useDeletePattern()

  // Hydrate MechBuilder with existing pattern data
  // Handle save (update) and delete
}
```

---

## Dashboard Pattern Section

### `src/components/dashboard/PatternSection.tsx` (NEW)

- Pseudoheader: "PATTERNS"
- Grid of pattern cards (catalog-style)
- "Create a Pattern" button -> navigates to `/patterns/new`
- Each card shows: pattern name, chassis name, system/module count summary
- Click card -> navigates to `/patterns/$patternId` (edit mode)
- Empty state: "No patterns yet. Design your first mech loadout."
- Loading state: skeleton cards

### `src/components/dashboard/PatternCard.tsx` (NEW)

```typescript
type PatternCardProps = {
  pattern: MechPatternRow
}

export function PatternCard({ pattern }: PatternCardProps)
```

- Catalog-style card (green left border — chassis color)
- Shows: pattern name, chassis name (resolved), system count / module count
- Click navigates to edit

---

## ShadCN Components Needed

Install these ShadCN components for Phase 2:

- `button` — Actions, save, add
- `card` — Library cards
- `input` — Pattern name input
- `skeleton` — Loading states
- `badge` — Slot counts, stat labels
- `separator` — Section dividers
- `dialog` — Entity selection modals, confirmations
- `tooltip` — Entity hover info

---

## File Summary

### New Files (ITUN) -- 12

```
# API + hooks + types
src/lib/api/patternApi.ts
src/hooks/usePatterns.ts
src/types/pattern.ts

# Pattern builder
src/components/pattern/MechBuilder.tsx
src/components/pattern/MechBuilderHeader.tsx
src/components/pattern/MechBuilderFooter.tsx
src/components/pattern/EntitySelectionModal.tsx

# Pattern routes
src/routes/_authenticated/patterns/new.tsx
src/routes/_authenticated/patterns/$patternId.tsx

# Dashboard
src/components/dashboard/PatternSection.tsx
src/components/dashboard/PatternCard.tsx
```

### Modified Files (ITUN) -- 1

```
src/routes/_authenticated/index.tsx   -- Add PatternSection to dashboard
```

---

## Implementation Order

1. **Types** -- `src/types/pattern.ts`
2. **API layer** -- patternApi
3. **Query hooks** -- usePatterns with key factory
4. **MechBuilder component** -- Core builder with DisplayCard + EntitySelectionModal
5. **Pattern routes** -- new + edit routes
6. **Dashboard** -- PatternSection + PatternCard, update dashboard route
