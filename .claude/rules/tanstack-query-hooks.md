---
paths:
  - 'apps/in-the-union-now/src/**'
---

# TanStack Query Hooks (ITUN)

ITUN is local-first ([ADR-001](../../docs/adrs/ADR-001-local-first-no-backend.md)).
There is **no API backend** for player data, so TanStack Query is **not** the
persistence cache. Persistent entity state (pilots, mechs, crawlers, workspaces,
soft-links, mech patterns) flows through the **Zustand stores**
(`src/stores/entityStore.ts`, `workspaceStore.ts`), which write through to
IndexedDB ([ADR-002](../../docs/adrs/ADR-002-indexeddb-idb-zod.md),
[ADR-003](../../docs/adrs/ADR-003-zustand-hydration.md)).

Use TanStack Query **only** for genuinely async / derived / server-touching
data:

- Snapshot publish/retrieve (`src/lib/snapshot/`,
  [ADR-004](../../docs/adrs/ADR-004-snapshot-netlify-functions.md)) — the one
  network surface.
- Expensive derived views you want cached/deduped across components.

## Do Not

- Do **not** route pilots/mechs/crawlers through `useQuery`/`useMutation`. Read
  them from `entityStore` (synchronous after lazy hydration) and mutate via
  `entityStore.update(...)` / `create` / `delete`.
- Do **not** reintroduce `fetchEntity`/`updateEntity`, hosted-DB `Tables<...>`
  types, or `isLocalId` checks — those are from the removed backend era.

## Client defaults

Defaults live in `src/lib/queryClient.ts`:

```typescript
queries:   { staleTime: 5 min, gcTime: 10 min, retry: 1, refetchOnWindowFocus: false }
mutations: { retry: 0 }
```

## Query key factories

When you do use Query, export a hierarchical key factory:

```typescript
export const snapshotKeys = {
  all: ['snapshots'] as const,
  detail: (id: string) => [...snapshotKeys.all, id] as const,
}
```

## Hook naming

- `use*` for queries (e.g. `useSnapshot`).
- `useUpdate*` / `useCreate*` for the rare network mutations.
- `use*Keys` for the exported key factory (not a hook).

## Examples

**Query (snapshot retrieval — the legitimate async case):**

```typescript
export function useSnapshot(id: string | undefined) {
  return useQuery({
    queryKey: snapshotKeys.detail(id!),
    queryFn: () => retrieveSnapshot(id!), // from src/lib/snapshot/client.ts
    enabled: !!id,
  })
}
```

**Persistent entity read/write (NOT Query — use the store):**

```typescript
// read (synchronous after hydration)
const pilots = useEntityStore((s) => s.list('pilots'))

// write (persists to IndexedDB first, then updates memory + broadcasts)
await useEntityStore.getState().update('pilots', id, { hp: next })
```

See [data-flow.md](../../docs/architecture/data-flow.md) for the full picture.
