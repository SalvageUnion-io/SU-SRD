# TanStack Query Hooks

> **Applies to:** `apps/suref-web/src/hooks/**/*.ts`, `apps/suref-web/src/hooks/**/*.tsx`

TanStack Query hook patterns for data fetching with query key factories, local data support, and mutations.

## Hook Structure

- Query key factory at the top
- `useQuery` hooks for fetching
- `useMutation` hooks for updates
- Support for both API-backed and local (cache-only) data

## Query Key Factories

Export a query key factory object (e.g., `pilotsKeys`, `mechsKeys`):

- Use hierarchical keys: `['resource', 'subresource', id]`
- Example: `pilotsKeys.all`, `pilotsKeys.detail(id)`, `pilotsKeys.forCrawler(crawlerId)`

```typescript
export const pilotsKeys = {
  all: ['pilots'] as const,
  detail: (id: string) => [...pilotsKeys.all, id] as const,
  forCrawler: (crawlerId: string) => [...pilotsKeys.all, 'crawler', crawlerId] as const,
}
```

## Hook Naming Conventions

- `use*` for queries (e.g., `usePilot`, `usePilots`)
- `useHydrated*` for hydrated entities with related data (e.g., `useHydratedPilot`)
- `useUpdate*`, `useCreate*`, `useDelete*` for mutations
- `use*Keys` for query key factories (exported, not hooks)

## Local Data Support

- Use `LOCAL_ID` constant for cache-only data that doesn't persist
- Check `isLocalId(id)` before making API calls
- Use `generateLocalId()` for new local entities
- Use `addToCache()`, `updateInCache()`, `removeFromCache()` helpers

## Mutation Best Practices

- Always invalidate related query keys on success
- Use optimistic updates when possible
- Handle errors appropriately (don't swallow them)

## Examples

**Query hook:**

```typescript
export function usePilot(id: string | undefined) {
  return useQuery({
    queryKey: pilotsKeys.detail(id!),
    queryFn: () => fetchEntity<Tables<'pilots'>>('pilots', id!),
    enabled: !!id && !isLocalId(id),
  })
}
```

**Mutation hook:**

```typescript
export function useUpdatePilot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: TablesUpdate<'pilots'> }) =>
      updateEntity('pilots', id, updates),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: pilotsKeys.detail(id) })
    },
  })
}
```

## Hydrated Hooks

Hydrated hooks combine entity data with related data (choices, references):

- Return a custom interface (e.g., `HydratedPilot`, `HydratedMech`)
- Include the base entity plus hydrated relationships
- Use `useQuery` to fetch base entity, then hydrate with related data
