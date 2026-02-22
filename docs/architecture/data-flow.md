# Data Flow Architecture

Two data domains meet at render time: **static reference data** (game rules from `salvageunion-reference`) and **dynamic player data** (Supabase). The ITUN app hydrates player records by resolving schema references against the bundled game data.

## Static Reference Data

**Package:** `packages/salvageunion-reference/`

### How It Works

All game data is bundled as JSON and loaded synchronously at import time. Zod schemas validate data at model construction. Each entity type gets a `BaseModel<T>` instance with O(1) ID lookups via an internal `Map`.

### Access Patterns

```typescript
import { SalvageUnionReference } from 'salvageunion-reference'

// Direct model access (27 models)
SalvageUnionReference.Chassis.getById('iron-mongrel')     // O(1) lookup
SalvageUnionReference.Chassis.all()                        // All entities
SalvageUnionReference.Chassis.find(c => c.techLevel === 2) // Predicate search
SalvageUnionReference.Chassis.findAll(c => c.source === 'Core Rules')

// Generic schema access (cross-schema queries)
SalvageUnionReference.get('chassis', 'iron-mongrel')       // By schema name + ID
SalvageUnionReference.exists('abilities', 'bionic-senses')
SalvageUnionReference.getMany([{ schemaName: 'abilities', id: 'id1' }, ...])

// Reference strings (double-colon format: "schemaName::id")
SalvageUnionReference.composeRef('abilities', 'bionic-senses')  // -> 'abilities::bionic-senses'
SalvageUnionReference.parseRef('abilities::bionic-senses')      // -> { schemaName, id }
SalvageUnionReference.getByRef('abilities::bionic-senses')
SalvageUnionReference.getManyByRef(['abilities::bionic-senses', 'systems::laser'])

// Metadata extraction
SalvageUnionReference.getTechLevel(entity)      // number | 'B' | 'N' | undefined
SalvageUnionReference.getTechLevelNumber(entity) // number | undefined (normalizes B/N to 1)
SalvageUnionReference.getSalvageValue(entity)

// Search
SalvageUnionReference.search({ query: 'laser', limit: 10 })
SalvageUnionReference.searchIn('equipment', 'laser')
SalvageUnionReference.getSuggestions('las')
```

### Type System

Entity types follow the pattern `SURef{EntityName}` (e.g., `SURefChassis`, `SURefAbility`). The `SchemaToEntityMap` maps schema name strings to their TypeScript types for type-safe generic access.

```typescript
type SchemaToEntityMap = {
  abilities: SURefAbility
  chassis: SURefChassis
  classes: SURefClass
  // ... 27 total schema mappings
}

type SURefEntity = SURefAbility | SURefChassis | SURefClass | ... // Union of all
type SURefEnumSchemaName = keyof SchemaToEntityMap                // String union
```

---

## Dynamic Player Data (Supabase)

**Project:** `dshtuchbleipwqacyokz` (us-east-2)

### Core Tables

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `pilots` | Player characters | `callsign`, `class_ref`, `hp/ap/tp`, `mech_id`, `crawler_id`, `is_boarded`, `in_downtime` |
| `mechs` | Player mechs | `chassis_ref`, `pattern_name`, `current_hp/sp`, `pattern_items` (JSON) |
| `crawlers` | Player crawlers | `crawler_ref`, `name`, `tech_level`, `current_sp`, `scrap_tl1`-`scrap_tl6`, `bay_npcs` (JSON) |
| `entity_refs` | Bridge: player data -> game data | `parent_id`, `parent_type`, `schema_name`, `schema_ref_id`, `condition`, `sort_order` |
| `player_choices` | User selections (class, comrade name, etc.) | `parent_id`, `parent_type`, `choice_key`, `choice_value` |
| `cargo` | Inventory items | `parent_id`, `parent_type`, `name`, `amount`, `schema_name`, `schema_ref_id` |
| `change_log` | Audit trail | `target_id`, `target_type`, `action`, `field`, `old_value`, `new_value`, `description` |
| `campaigns` | Multiplayer games | `name`, `owner_id`, `invite_code` |
| `campaign_members` | Player-campaign links | `campaign_id`, `pilot_id`, `role` |
| `mech_patterns` | Saved mech builds | `chassis_ref`, `pattern_name`, `pattern_items` |

### The entity_refs Hydration Pattern

Player data stores only references to game data, not copies. The `entity_refs` table bridges the two domains:

```sql
-- Example: pilot "Nova" has the ability "Bionic Senses"
-- pilots table
id: 'p1', callsign: 'Nova', class_ref: 'hybrid-wolf'

-- entity_refs table
parent_id: 'p1', parent_type: 'pilot',
schema_name: 'abilities', schema_ref_id: 'bionic-senses',
condition: 'intact', sort_order: 0
```

At render time, ITUN hydrates by calling `SalvageUnionReference.get(ref.schema_name, ref.schema_ref_id)` to get the full entity data:

```typescript
// In usePilotSheet hook
const pilotClass = useMemo(
  () => pilot ? SalvageUnionReference.get('classes', pilot.class_ref) : undefined,
  [pilot]
)

// For entity_refs
const entity = SalvageUnionReference.get(
  ref.schema_name as EntitySchemaName,
  ref.schema_ref_id
)
```

### Enums

```typescript
parent_type: 'pilot' | 'mech' | 'crawler'
item_condition: 'intact' | 'damaged' | 'destroyed'
```

All tables have RLS policies scoped to `user_id` (owned data) or via campaign membership (shared data).

---

## Full Data Flow Trace: Loading a Pilot Sheet

### Route -> Hook -> Queries -> Hydration -> Render

**1. Route** (`src/routes/pilots/$pilotId.tsx`): Extracts `pilotId` from URL params.

**2. Orchestration Hook** (`usePilotSheet`): Coordinates ~10 queries and all mutations for the pilot view.

**3. Core Queries** (TanStack Query):
```typescript
const { data: pilot } = usePilot(pilotId)               // pilots table
const { data: pilotRefs } = usePilotEntityRefs(pilotId)  // entity_refs where parent_id = pilotId
const { data: mech } = useMech(pilot?.mech_id)           // mechs table (if boarded)
const { data: mechRefs } = useMechEntityRefs(mech?.id)   // entity_refs for mech
```

**4. Realtime Subscriptions** (4 channels):
```typescript
useRealtimeSubscription('pilots', `id=eq.${pilotId}`, [pilotKeys.detail(pilotId)])
useRealtimeSubscription('entity_refs', `parent_id=eq.${pilotId}`, [pilotKeys.entityRefs(pilotId)])
useRealtimeSubscription('mechs', mechFilter, [mechKeys.detail(mechId)])
useRealtimeSubscription('entity_refs', mechRefsFilter, [mechKeys.entityRefs(mechId)])
```

**5. Hydration** (useMemo, synchronous):
```typescript
const pilotClass = SalvageUnionReference.get('classes', pilot.class_ref)
const mechChassis = findChassisById(mech.chassis_ref)
const comrades = extractComrades(pilotRefs, mechRefs, mechChassis)
```

**6. Mutation Handlers**: Each handler calls the mutation, logs to `changeLogApi`, and shows a toast.

**7. Return**: `{ pilot, pilotRefs, mech, mechRefs, mechChassis, pilotClass, comrades, editConfig }` — consumed by `PlayerPilotDisplay`.

---

## TanStack Query Patterns

### Configuration

```typescript
// src/lib/queryClient.ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,     // 5 minutes
      gcTime: 1000 * 60 * 10,       // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
})
```

### Query Key Factories

Hierarchical key structure enables targeted invalidation:

```typescript
export const pilotKeys = {
  all: ['pilots'] as const,
  lists: () => [...pilotKeys.all, 'list'] as const,
  list: (userId: string) => [...pilotKeys.lists(), userId] as const,
  details: () => [...pilotKeys.all, 'detail'] as const,
  detail: (id: string) => [...pilotKeys.details(), id] as const,
  entityRefs: (pilotId: string) => [...pilotKeys.all, 'entityRefs', pilotId] as const,
}
```

Each resource (`mechs`, `crawlers`, `campaigns`, etc.) follows the same factory pattern.

### Optimistic Updates

```typescript
export function useUpdatePilot() {
  return useMutation({
    mutationFn: ({ pilotId, input }) => updatePilot(pilotId, input),

    // 1. Optimistic update (immediate UI feedback)
    onMutate: async ({ pilotId, input }) => {
      await queryClient.cancelQueries({ queryKey: pilotKeys.detail(pilotId) })
      const previous = queryClient.getQueryData(pilotKeys.detail(pilotId))
      queryClient.setQueryData(pilotKeys.detail(pilotId), { ...previous, ...input })
      return { previous }
    },

    // 2. Rollback on error
    onError: (_err, { pilotId }, context) => {
      queryClient.setQueryData(pilotKeys.detail(pilotId), context?.previous)
    },

    // 3. Canonical update on success
    onSuccess: (data, { userId }) => {
      queryClient.invalidateQueries({ queryKey: pilotKeys.list(userId) })
      queryClient.setQueryData(pilotKeys.detail(data.id), data)
    },
  })
}
```

---

## API Layer

**Location:** `apps/in-the-union-now/src/lib/api/`

One file per resource: `pilotApi.ts`, `mechApi.ts`, `crawlerApi.ts`, `entityRefApi.ts`, `playerChoiceApi.ts`, `cargoApi.ts`, `changeLogApi.ts`, `campaignMemberApi.ts`, `gameApi.ts`, `patternApi.ts`.

All functions are async/await, use the typed Supabase client, and throw via `handleSupabaseError(error)` on failure. TanStack Query's `onError` callback handles the thrown error.

```typescript
export async function getPilotById(pilotId: string): Promise<PilotRow> {
  const { data, error } = await supabase.from('pilots').select('*').eq('id', pilotId).single()
  if (error) handleSupabaseError(error)
  return data!
}
```

---

## Realtime Subscriptions

**File:** `apps/in-the-union-now/src/hooks/useRealtimeSubscription.ts`

Subscribes to Postgres changes and invalidates TanStack Query caches. No API changes required.

```typescript
function useRealtimeSubscription(table: string, filter: string | undefined, queryKeys: QueryKey[]) {
  // Subscribes to INSERT/UPDATE/DELETE on table with filter
  // On any change: invalidates all provided query keys
  // Cleanup: removes channel on unmount
}
```

This is additive: the existing query/mutation flow works without realtime. Realtime just ensures multi-client consistency by triggering cache invalidation.

---

## State Management

### Zustand: Auth Only

**File:** `apps/in-the-union-now/src/stores/authStore.ts`

Zustand manages only auth state (user identity/session). Uses `supabase.auth.onAuthStateChange()` to stay in sync.

```typescript
type AuthState = {
  user: User | null
  loading: boolean
  initialize: () => () => void   // Returns unsubscribe function
  signIn, signUp, resetPassword, signOut
}
```

All entity data lives in TanStack Query caches, not Zustand.

### Change Log: Fire-and-Forget Audit Trail

**File:** `apps/in-the-union-now/src/lib/api/changeLogApi.ts`

```typescript
changeLogApi.log(userId, {
  targetId: pilot.id,
  targetType: 'pilot',
  action: 'update',
  field: 'hp',
  oldValue: 10, newValue: 8,
  description: 'Nova HP 10 -> 8',
})
```

Called from mutation handlers. Does not block the mutation flow.

---

## Complete Data Flow Diagram

```
User Action (click +/- on HP stat)
    |
    v
Mutation Hook (useUpdatePilot)
    |
    v
onMutate: Optimistic update in TanStack Query cache -> UI updates immediately
    |
    v
mutationFn: pilotApi.updatePilot(pilotId, { hp: newValue })
    |
    v
Supabase: UPDATE pilots SET hp = newValue WHERE id = pilotId
    |
    +---> change_log INSERT (fire-and-forget audit)
    |
    v
Realtime: Postgres notifies subscribed clients
    |
    v
useRealtimeSubscription: Invalidates pilotKeys.detail(pilotId)
    |
    v
TanStack Query: Refetches pilot data from Supabase
    |
    v
onSuccess: Sets canonical cache data, shows toast
    |
    v
Components: Re-render with confirmed data
```

**Error path:** `onError` -> rollback optimistic update -> show error toast.

---

## Cross-References

- `.claude/rules/tanstack-query-hooks.md` — Query key factory conventions, hook naming, mutation patterns
- `.claude/rules/supabase-api.md` — Client setup, typed queries, RLS, error handling
- `.claude/rules/entity-data-resolution.md` — Quick-reference rule for editing hooks/API layer
