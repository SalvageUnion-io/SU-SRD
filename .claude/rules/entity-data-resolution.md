---
paths:
  - apps/in-the-union-now/src/hooks/**
  - apps/in-the-union-now/src/lib/api/**
---

# Entity Data Resolution Rules

See `docs/architecture/data-flow.md` for the full architecture.

## Core Pattern: Store Ref, Hydrate at Render

Player data stores only references to game data via the `entity_refs` table:

```
entity_refs row: { parent_id, parent_type, schema_name, schema_ref_id, condition, sort_order }
```

At query time, hydrate by calling:

```typescript
SalvageUnionReference.get(ref.schema_name as EntitySchemaName, ref.schema_ref_id)
```

Never store copies of game data in player tables. The `entity_refs` pattern is the canonical bridge.

## Query Key Factories

Every resource uses a hierarchical key factory:

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

Follow this exact pattern for new resources. The hierarchy enables targeted invalidation (e.g., invalidate `pilotKeys.all` to refetch everything, or `pilotKeys.detail(id)` for one pilot).

## Optimistic Updates

Mutations follow a three-step pattern:

1. **onMutate**: Cancel in-flight queries, snapshot previous data, optimistically update cache
2. **onError**: Rollback to snapshot
3. **onSuccess**: Invalidate related list queries, set canonical cache data

Always capture `previous` in `onMutate` and return it as context for `onError` rollback.

## Realtime Subscriptions

`useRealtimeSubscription(table, filter, queryKeys)` subscribes to Postgres changes and invalidates TanStack Query caches. This is additive — the app works without it, realtime just ensures multi-client consistency.

Pattern in orchestration hooks:

```typescript
useRealtimeSubscription('pilots', `id=eq.${pilotId}`, [pilotKeys.detail(pilotId)])
useRealtimeSubscription('entity_refs', `parent_id=eq.${pilotId}`, [pilotKeys.entityRefs(pilotId)])
```

## API Layer

One file per resource in `src/lib/api/`. All functions are async/await, use the typed Supabase client, and throw via `handleSupabaseError(error)`. Use `.single()` for single-row queries.

## Change Log

Fire-and-forget audit trail. Call `changeLogApi.log()` from mutation handlers. Does not block the mutation flow.

## State Management

- **TanStack Query**: All entity data (pilots, mechs, entity_refs, etc.)
- **Zustand**: Auth store only (user identity/session)
- Never store entity data in Zustand or React Context
