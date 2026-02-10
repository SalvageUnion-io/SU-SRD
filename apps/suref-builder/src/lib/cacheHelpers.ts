/**
 * Cache-only helpers for TanStack Query
 *
 * These utilities allow working with TanStack Query's cache directly
 * without making API calls. Useful for:
 * - Local/temporary data that doesn't need persistence
 * - Optimistic updates
 * - Testing
 * - Mixed API + local data in the same app
 */

import type { QueryClient } from '@tanstack/react-query'

export const LOCAL_ID = 'local' as const
export const isLocalId = (id: string | undefined) => id?.startsWith('local') ?? false

/**
 * Generate a unique ID for cache-only entities
 * Uses timestamp + random string for uniqueness
 *
 * @example
 * ```typescript
 * const newItem = { id: generateLocalId(), name: 'New Item' }
 * ```
 */
export function generateLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Update query cache with new data
 * Works for both online and offline modes
 *
 * @param queryClient - TanStack Query client
 * @param queryKey - Query key to update
 * @param updater - Function to update the cached data
 *
 * @example
 * ```typescript
 * updateCache(queryClient, ['mechs', mechId], (oldData) => {
 *   return { ...oldData, name: 'New Name' }
 * })
 * ```
 */
export function updateCache<T>(
  queryClient: QueryClient,
  queryKey: unknown[],
  updater: (oldData: T | undefined) => T
): void {
  queryClient.setQueryData<T>(queryKey, (oldData) => updater(oldData))
}

/**
 * Add item to a cached array
 *
 * @param queryClient - TanStack Query client
 * @param queryKey - Query key for the array
 * @param newItem - Item to add
 *
 * @example
 * ```typescript
 * addToCache(queryClient, ['cargo', 'mech', mechId], newCargoItem)
 * ```
 */
export function addToCache<T>(queryClient: QueryClient, queryKey: unknown[], newItem: T): void {
  queryClient.setQueryData<T[]>(queryKey, (oldData = []) => [...oldData, newItem])
}

/**
 * Remove item from a cached array by ID
 *
 * @param queryClient - TanStack Query client
 * @param queryKey - Query key for the array
 * @param itemId - ID of item to remove
 *
 * @example
 * ```typescript
 * removeFromCache(queryClient, ['cargo', 'mech', mechId], cargoId)
 * ```
 */
export function removeFromCache<T extends { id: string }>(
  queryClient: QueryClient,
  queryKey: unknown[],
  itemId: string
): void {
  queryClient.setQueryData<T[]>(queryKey, (oldData = []) =>
    oldData.filter((item) => item.id !== itemId)
  )
}

/**
 * Update item in a cached array by ID
 *
 * @param queryClient - TanStack Query client
 * @param queryKey - Query key for the array
 * @param itemId - ID of item to update
 * @param updater - Function to update the item
 *
 * @example
 * ```typescript
 * updateInCache(queryClient, ['cargo', 'mech', mechId], cargoId, (item) => ({
 *   ...item,
 *   amount: item.amount + 1
 * }))
 * ```
 */
export function updateInCache<T extends { id: string }>(
  queryClient: QueryClient,
  queryKey: unknown[],
  itemId: string,
  updater: (item: T) => T
): void {
  queryClient.setQueryData<T[]>(queryKey, (oldData = []) =>
    oldData.map((item) => (item.id === itemId ? updater(item) : item))
  )
}

/**
 * Create a cache-only mutation function
 * Returns a function that updates the cache without calling the API
 *
 * @param queryClient - TanStack Query client
 * @param queryKey - Query key to invalidate after mutation
 * @param mutationFn - Function to update the cache
 *
 * @example
 * ```typescript
 * const createCargoLocal = createCacheOnlyMutation(
 *   queryClient,
 *   ['cargo', 'mech', LOCAL_ID],
 *   (newCargo) => {
 *     const cargoWithId = { ...newCargo, id: generateLocalId() }
 *     addToCache(queryClient, ['cargo', 'mech', LOCAL_ID], cargoWithId)
 *     return cargoWithId
 *   }
 * )
 * ```
 */
export function createCacheOnlyMutation<TData, TVariables>(
  queryClient: QueryClient,
  queryKey: unknown[],
  mutationFn: (variables: TVariables) => TData
): (variables: TVariables) => Promise<TData> {
  return async (variables: TVariables) => {
    const result = mutationFn(variables)

    await queryClient.invalidateQueries({ queryKey })
    return result
  }
}
